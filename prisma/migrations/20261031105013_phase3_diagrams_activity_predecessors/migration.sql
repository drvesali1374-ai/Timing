-- AlterTable
ALTER TABLE "Activity" ADD COLUMN "predecessorsJson" TEXT;

-- CreateTable
CREATE TABLE "Diagram" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "variant" TEXT NOT NULL DEFAULT 'current',
    "variantOfId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT,
    "distanceUnit" TEXT DEFAULT 'm',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currentRev" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Diagram_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Diagram_variantOfId_fkey" FOREIGN KEY ("variantOfId") REFERENCES "Diagram" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DiagramRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "diagramId" TEXT NOT NULL,
    "revNo" INTEGER NOT NULL,
    "reason" TEXT,
    "docJson" TEXT NOT NULL,
    "layoutJson" TEXT NOT NULL,
    "validationJson" TEXT NOT NULL,
    "appliedSuggestionsJson" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'normal',
    "clientOpId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiagramRevision_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "Diagram" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Diagram_projectId_status_idx" ON "Diagram"("projectId", "status");

-- CreateIndex
CREATE INDEX "Diagram_projectId_kind_idx" ON "Diagram"("projectId", "kind");

-- CreateIndex
CREATE INDEX "DiagramRevision_diagramId_createdAt_idx" ON "DiagramRevision"("diagramId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DiagramRevision_diagramId_revNo_key" ON "DiagramRevision"("diagramId", "revNo");
