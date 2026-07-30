from fastapi import FastAPI

app = FastAPI(
    title="EPIC Payments API",
    version="0.1.0",
)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "EPIC Payments API está a funcionar"}


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "healthy"}