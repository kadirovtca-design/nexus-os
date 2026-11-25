from fastapi import APIRouter, status
from sqlalchemy import func, select

from app.api.deps import DB, CurrentUser
from app.models import Project, Task
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate
from app.services import activity
from app.services.crud import apply_patch, get_owned_or_404, owned

router = APIRouter(prefix="/projects", tags=["projects"])


def _with_stats(db, projects: list[Project]) -> list[ProjectOut]:
    ids = [p.id for p in projects]
    counts: dict[int, tuple[int, int]] = {}
    if ids:
        rows = db.execute(
            select(Task.project_id, func.count(), func.count().filter(Task.status == "done"))
            .where(Task.project_id.in_(ids)).group_by(Task.project_id)
        )
        counts = {pid: (total, done) for pid, total, done in rows}
    out = []
    for p in projects:
        total, done = counts.get(p.id, (0, 0))
        progress = 100 if p.status == "completed" else (round(done * 100 / total) if total else 0)
        out.append(ProjectOut.model_validate(p, from_attributes=True).model_copy(
            update={"task_count": total, "completed_count": done, "progress": progress}))
    return out


@router.get("", response_model=list[ProjectOut])
def list_projects(user: CurrentUser, db: DB, include_archived: bool = False):
    stmt = owned(Project, user.id)
    if not include_archived:
        stmt = stmt.where(Project.status != "archived")
    projects = db.scalars(stmt.order_by(Project.created_at.desc())).all()
    return _with_stats(db, list(projects))


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, user: CurrentUser, db: DB):
    project = Project(user_id=user.id, **payload.model_dump())
    db.add(project)
    db.flush()
    activity.log(db, user.id, "created", "project", project.id, f'Created project "{project.name}"')
    db.commit()
    return _with_stats(db, [project])[0]


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, user: CurrentUser, db: DB):
    return _with_stats(db, [get_owned_or_404(db, Project, project_id, user.id, "Project")])[0]


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, payload: ProjectUpdate, user: CurrentUser, db: DB):
    project = get_owned_or_404(db, Project, project_id, user.id, "Project")
    before = project.status
    apply_patch(project, payload)
    if project.status == "completed" and before != "completed":
        activity.log(db, user.id, "completed", "project", project.id, f'Completed project "{project.name}"')
    else:
        activity.log(db, user.id, "updated", "project", project.id, f'Updated project "{project.name}"')
    db.commit()
    return _with_stats(db, [project])[0]


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, user: CurrentUser, db: DB, delete_tasks: bool = False):
    project = get_owned_or_404(db, Project, project_id, user.id, "Project")
    if delete_tasks:
        for t in db.scalars(owned(Task, user.id).where(Task.project_id == project.id)):
            db.delete(t)
    activity.log(db, user.id, "deleted", "project", project.id, f'Deleted project "{project.name}"')
    db.delete(project)
    db.commit()
