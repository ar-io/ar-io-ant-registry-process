local schemas = {}

schemas.ant_index = [[
        CREATE TABLE IF NOT EXISTS ant_index (
            ant_id TEXT PRIMARY KEY NOT NULL, 
            owner TEXT NOT NULL,
            registered_at INTEGER NOT NULL,
            last_updated INTEGER NOT NULL
        );
    ]]

schemas.controllers_index = [[
        CREATE TABLE IF NOT EXISTS ant_controllers (
            ant_id TEXT NOT NULL,
            controller TEXT NOT NULL,
            last_updated INTEGER NOT NULL,
            PRIMARY KEY (ant_id, controller),
            FOREIGN KEY (ant_id) REFERENCES ant_index (ant_id)
            FOREIGN KEY (last_updated) REFERENCES ant_index (last_updated)
        );
    ]]

return schemas
