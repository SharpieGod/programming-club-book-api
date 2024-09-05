import authors from "./authors.json" assert { type: "json" };
import books from "./books.json" assert { type: "json" };
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

await db.book.createMany({ data: books });
