import uvicorn
import os
import sys

if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    print("\n" + "="*50)
    print("Starting MyCinemaList Full-Stack Application")
    print("Local Server: http://127.0.0.1:8000")
    print("OpenAPI Docs: http://127.0.0.1:8000/docs")
    print("="*50 + "\n")
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
