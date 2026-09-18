import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const ticketTypes = [
    "Soporte técnico",
    "Solicitud de equipo",
    "Solicitud de software",
    "Mantenimiento",
    "Incidente de red",
    "Otro",
  ];

  for (const name of ticketTypes) {
    await prisma.ticketType.upsert({ where: { name }, update: {}, create: { name } });
  }

  const adminPassword = await bcrypt.hash("Admin123!", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@fullpetro.com" },
    update: {},
    create: {
      name: "Administrador TI",
      email: "admin@fullpetro.com",
      passwordHash: adminPassword,
      role: "ADMIN",
      department: "Tecnología",
    },
  });

  const agentPassword = await bcrypt.hash("Agente123!", 10);
  await prisma.user.upsert({
    where: { email: "agente@fullpetro.com" },
    update: {},
    create: {
      name: "Agente de Soporte",
      email: "agente@fullpetro.com",
      passwordHash: agentPassword,
      role: "AGENT",
      department: "Tecnología",
    },
  });

  const userPassword = await bcrypt.hash("Usuario123!", 10);
  await prisma.user.upsert({
    where: { email: "usuario@fullpetro.com" },
    update: {},
    create: {
      name: "Usuario Solicitante",
      email: "usuario@fullpetro.com",
      passwordHash: userPassword,
      role: "REQUESTER",
      department: "Operaciones",
    },
  });

  console.log("Seed completado.");
  console.log("Admin:", admin.email, "/ Admin123!");
  console.log("Agente: agente@fullpetro.com / Agente123!");
  console.log("Usuario: usuario@fullpetro.com / Usuario123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
