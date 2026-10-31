-- CreateTable
CREATE TABLE "TimingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "observer" TEXT NOT NULL,
    "elementsJson" TEXT NOT NULL,
    "elementAdvanceMode" TEXT NOT NULL DEFAULT 'manual',
    "tolerancePct" REAL NOT NULL DEFAULT 5,
    "elementSource" TEXT NOT NULL DEFAULT 'activities',
    "diagramRefId" TEXT,
    "diagramRefNote" TEXT,
    "integrityFlagsJson" TEXT,
    "notes" TEXT,
    "startedAtWall" DATETIME,
    "endedAtWall" DATETIME,
    "deviceMetaJson" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimingSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "clientEventId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "elementId" TEXT,
    "cycleNo" INTEGER NOT NULL DEFAULT 0,
    "elapsedActiveMs" REAL NOT NULL,
    "splitMs" REAL,
    "wallClock" DATETIME NOT NULL,
    "note" TEXT,
    "interruptionReason" TEXT,
    "correctionOf" TEXT,
    "correctedValueMs" REAL,
    "correctionReason" TEXT,
    "integrityJson" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'normal',
    "receivedBy" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimingEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TimingSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimingCycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "startedAtEventId" TEXT NOT NULL,
    "endedAtEventId" TEXT,
    "startedElapsedMs" REAL NOT NULL,
    "endedElapsedMs" REAL,
    "cycleTimeMs" REAL,
    "elementsSumMs" REAL NOT NULL,
    "deviationPct" REAL,
    "elementsJson" TEXT NOT NULL,
    "interruptionsJson" TEXT NOT NULL,
    "flagsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimingCycle_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TimingSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TimingSession_projectId_status_idx" ON "TimingSession"("projectId", "status");

-- CreateIndex
CREATE INDEX "TimingSession_projectId_createdAt_idx" ON "TimingSession"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TimingEvent_clientEventId_key" ON "TimingEvent"("clientEventId");

-- CreateIndex
CREATE INDEX "TimingEvent_sessionId_seq_idx" ON "TimingEvent"("sessionId", "seq");

-- CreateIndex
CREATE INDEX "TimingEvent_sessionId_type_idx" ON "TimingEvent"("sessionId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "TimingEvent_sessionId_seq_key" ON "TimingEvent"("sessionId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "TimingEvent_sessionId_clientEventId_key" ON "TimingEvent"("sessionId", "clientEventId");

-- CreateIndex
CREATE INDEX "TimingCycle_sessionId_status_idx" ON "TimingCycle"("sessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TimingCycle_sessionId_seq_key" ON "TimingCycle"("sessionId", "seq");
