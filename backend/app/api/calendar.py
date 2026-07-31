from fastapi import APIRouter

router = APIRouter(
    prefix="/calendar",
    tags=["Calendar"],
)


@router.get("/ping")
def ping():

    return {
        "message": "Calendar API OK"
    }