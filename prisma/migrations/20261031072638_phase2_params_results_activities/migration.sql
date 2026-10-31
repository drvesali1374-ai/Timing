-- CreateTable
CREATE TABLE "ParameterValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "stableKey" TEXT NOT NULL,
    "defVersion" INTEGER NOT NULL,
    "scopeType" TEXT NOT NULL DEFAULT 'project',
    "scopeId" TEXT NOT NULL DEFAULT '',
    "valueJson" TEXT NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ParameterValue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CalculationResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "formulaKey" TEXT NOT NULL,
    "formulaSemver" TEXT NOT NULL,
    "configVersionId" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL DEFAULT 'project',
    "scopeId" TEXT NOT NULL DEFAULT '',
    "valueJson" TEXT,
    "status" TEXT NOT NULL,
    "errorsJson" TEXT,
    "traceJson" TEXT NOT NULL,
    "inputRefsJson" TEXT NOT NULL,
    "computedBy" TEXT NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CalculationResult_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "stableKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "workType" TEXT NOT NULL DEFAULT 'operatorManual',
    "vaClassification" TEXT,
    "constraintsJson" TEXT,
    "stationHint" TEXT,
    "skillRequired" TEXT,
    "sourceOfTime" TEXT NOT NULL DEFAULT 'measured',
    "order" INTEGER NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Activity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ParameterValue_projectId_scopeType_idx" ON "ParameterValue"("projectId", "scopeType");

-- CreateIndex
CREATE UNIQUE INDEX "ParameterValue_projectId_stableKey_scopeType_scopeId_key" ON "ParameterValue"("projectId", "stableKey", "scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "CalculationResult_projectId_formulaKey_idx" ON "CalculationResult"("projectId", "formulaKey");

-- CreateIndex
CREATE INDEX "CalculationResult_projectId_computedAt_idx" ON "CalculationResult"("projectId", "computedAt");

-- CreateIndex
CREATE INDEX "Activity_projectId_archived_idx" ON "Activity"("projectId", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_projectId_stableKey_key" ON "Activity"("projectId", "stableKey");
