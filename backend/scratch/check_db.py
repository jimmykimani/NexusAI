from sqlalchemy import create_engine, MetaData, select, func
engine = create_engine("sqlite:///nexusai.db")
metadata = MetaData()
metadata.reflect(bind=engine)
ss_table = metadata.tables["search_sessions"]
with engine.connect() as conn:
    # Print the last 5 sessions and their user_ids
    res = conn.execute(select(ss_table).order_by(ss_table.c.created_at.desc()).limit(5)).fetchall()
    for row in res:
        print(f"Session {row.id} | User {row.user_id} | Created {row.created_at}")
