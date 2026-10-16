CREATE TABLE source_tombstones (
 owner_id text NOT NULL,device_id uuid NOT NULL,source_id text NOT NULL,
 PRIMARY KEY(owner_id,device_id,source_id),FOREIGN KEY(owner_id,device_id) REFERENCES devices(owner_id,id)
);
