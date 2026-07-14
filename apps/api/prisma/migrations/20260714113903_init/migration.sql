-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authId" TEXT
);

-- CreateTable
CREATE TABLE "SaveSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "gender" TEXT NOT NULL,
    "mcBlob" TEXT NOT NULL,
    "poolSelections" TEXT NOT NULL,
    "dmRead" TEXT NOT NULL,
    CONSTRAINT "SaveSlot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AxisValue" (
    "slotId" TEXT NOT NULL,
    "axis" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    PRIMARY KEY ("slotId", "axis"),
    CONSTRAINT "AxisValue_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "SaveSlot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CounterValue" (
    "slotId" TEXT NOT NULL,
    "counter" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    PRIMARY KEY ("slotId", "counter"),
    CONSTRAINT "CounterValue_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "SaveSlot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FlagSet" (
    "slotId" TEXT NOT NULL,
    "flag" TEXT NOT NULL,

    PRIMARY KEY ("slotId", "flag"),
    CONSTRAINT "FlagSet_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "SaveSlot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChoiceRecord" (
    "slotId" TEXT NOT NULL,
    "choiceId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,

    PRIMARY KEY ("slotId", "choiceId"),
    CONSTRAINT "ChoiceRecord_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "SaveSlot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Completion" (
    "slotId" TEXT NOT NULL,
    "threadKey" TEXT NOT NULL,
    "completedAt" BIGINT NOT NULL,

    PRIMARY KEY ("slotId", "threadKey"),
    CONSTRAINT "Completion_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "SaveSlot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_authId_key" ON "Player"("authId");

-- CreateIndex
CREATE UNIQUE INDEX "SaveSlot_playerId_slot_key" ON "SaveSlot"("playerId", "slot");
