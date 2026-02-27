-- AlterTable
ALTER TABLE "Candidacy" ADD COLUMN     "candidateId" TEXT,
ADD COLUMN     "communeId" TEXT;

-- CreateTable
CREATE TABLE "Commune" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentCode" TEXT NOT NULL,
    "departmentName" TEXT NOT NULL,
    "regionCode" TEXT,
    "postalCodes" TEXT[],
    "population" INTEGER,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "totalSeats" INTEGER,

    CONSTRAINT "Commune_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "gender" TEXT,
    "birthYear" INTEGER,
    "nationality" TEXT,
    "politicianId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Commune_departmentCode_idx" ON "Commune"("departmentCode");

-- CreateIndex
CREATE INDEX "Commune_name_idx" ON "Commune"("name");

-- CreateIndex
CREATE INDEX "Candidate_lastName_idx" ON "Candidate"("lastName");

-- CreateIndex
CREATE INDEX "Candidate_politicianId_idx" ON "Candidate"("politicianId");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_firstName_lastName_politicianId_key" ON "Candidate"("firstName", "lastName", "politicianId");

-- CreateIndex
CREATE INDEX "Candidacy_candidateId_idx" ON "Candidacy"("candidateId");

-- CreateIndex
CREATE INDEX "Candidacy_communeId_idx" ON "Candidacy"("communeId");

-- AddForeignKey
ALTER TABLE "Candidacy" ADD CONSTRAINT "Candidacy_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidacy" ADD CONSTRAINT "Candidacy_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE SET NULL ON UPDATE CASCADE;
