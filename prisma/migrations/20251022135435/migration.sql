-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "anilistId" INTEGER NOT NULL,
    "accessToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_anilistId_key" ON "User"("anilistId");
