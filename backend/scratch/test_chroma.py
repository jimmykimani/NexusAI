import chromadb
try:
    client = chromadb.PersistentClient(path="./chroma_db_test")
    print("ChromaDB initialized")
except Exception as e:
    print(f"ChromaDB failed: {e}")
