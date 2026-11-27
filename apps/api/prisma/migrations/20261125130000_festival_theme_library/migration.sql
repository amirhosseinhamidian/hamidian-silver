BEGIN;

ALTER TABLE "festival_theme_templates"
    ADD COLUMN "description" VARCHAR(240),
    ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
    ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "archivedAt" TIMESTAMPTZ(3);

UPDATE "festival_theme_templates" SET "updatedAt" = "createdAt";

CREATE TABLE "festival_theme_versions" (
    "templateName" VARCHAR(80) NOT NULL,
    "version" INTEGER NOT NULL CHECK ("version" > 0),
    "description" VARCHAR(240),
    "theme" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" UUID,
    CONSTRAINT "festival_theme_versions_pkey" PRIMARY KEY ("templateName", "version"),
    CONSTRAINT "festival_theme_versions_templateName_fkey"
      FOREIGN KEY ("templateName") REFERENCES "festival_theme_templates"("name") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "festival_theme_versions_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "festival_theme_versions" ("templateName", "version", "description", "theme", "createdAt")
SELECT "name", "version", "description", "theme", "createdAt" FROM "festival_theme_templates";

-- Older API instances may still create templates while a new release is starting.
CREATE FUNCTION seed_festival_theme_template_history() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO "festival_theme_versions" ("templateName", "version", "description", "theme", "createdAt")
    VALUES (NEW."name", NEW."version", NEW."description", NEW."theme", NEW."createdAt")
    ON CONFLICT ("templateName", "version") DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "festival_theme_templates_seed_history"
    AFTER INSERT ON "festival_theme_templates"
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION seed_festival_theme_template_history();

CREATE INDEX "festival_theme_templates_archivedAt_name_idx" ON "festival_theme_templates"("archivedAt", "name");
CREATE INDEX "festival_theme_versions_actorId_idx" ON "festival_theme_versions"("actorId");

COMMIT;
