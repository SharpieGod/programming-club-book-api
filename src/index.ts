import express from "express";
import bcrypt from "bcrypt";
import { Book, PrismaClient } from "@prisma/client";
import { z } from "zod";
import cors from "cors";

const db = new PrismaClient();
const app = express();

app.use(
  cors({
    origin: "*",
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

app.get("/", async (req, res) => {
  res.status(418).send({ message: "Hello, world!" });
});

const loginBody = z.object({
  username: z.string(),
  password: z.string(),
});
app.post("/login", async (req, res) => {
  const body = loginBody.safeParse(req.body);

  if (!body.success)
    return res.status(400).send({ error: "Invalid input." });

  try {
    const { username, password } = body.data;

    const user = await db.user.findFirst({
      where: {
        username,
      },
      select: {
        id: true,
        password: true,
      },
    });

    if (
      !user ||
      (user && !(await bcrypt.compare(password, user.password)))
    )
      return res.status(404).send({
        message: "Incorrect username and password combination.",
      });

    res.send({ message: "Login successful", userId: user.id });
  } catch {
    res.status(500).send({ message: "An unknown error occurred." });
  }
});
app.post("/register", async (req, res) => {
  const body = loginBody.safeParse(req.body);

  if (!body.success)
    return res.status(400).send({ message: "Invalid input." });

  const { password, username } = body.data;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const userCheck = await db.user.findFirst({
      where: {
        username,
      },
    });

    if (userCheck)
      return res
        .status(409)
        .send({ message: "User already exists." });

    const newUser = await db.user.create({
      data: {
        username,
        password: hashedPassword,
      },
      select: {
        id: true,
      },
    });

    res.send({
      message: "User created successfully",
      userId: newUser.id,
    });
  } catch {
    res.status(500).send({ message: "An unknown error occurred." });
  }
});

const searchBookBody = z.object({
  title: z.string(),
  author: z
    .string()
    .regex(/^[A-Z][a-z]+ [A-Z][a-z]+$/)
    .optional(),
  authorId: z
    .string()
    .regex(/^c[a-z0-9]{24}$/)
    .optional(),
});

app.post("/searchBooks", async (req, res) => {
  const body = searchBookBody.safeParse(req.body);

  if (!body.success)
    return res.status(400).send({ message: "Invalid input." });

  const { title, author, authorId } = body.data;

  try {
    const books = await db.book.findMany({
      where: {
        title: {
          contains: title,
        },
        author: {
          firstName: author?.split(" ")[0],
          lastName: author?.split(" ")[1],
          id: authorId,
        },
      },
      include: {
        author: true,
      },
    });

    if (!books)
      return res.status(404).send({
        message: "No books found.",
      });

    res.send({
      message: "Book found successfully.",
      books: books,
    });
  } catch {
    res.status(500).send({ message: "An unknown error occurred." });
  }
});

const bookListBody = z.object({
  author: z
    .string()
    .regex(/^[A-Z][a-z]+ [A-Z][a-z]+$/)
    .optional(),
  authorId: z
    .string()
    .regex(/^c[a-z0-9]{24}$/)
    .optional(),
  take: z.number().optional(),
  offset: z.number().optional(),
  orderBy: z
    .object({
      title: z.enum(["asc", "desc"]).optional(),
      datePublished: z.enum(["asc", "desc"]).optional(),
    })
    .optional(),
});
app.get("/books", async (req, res) => {
  const body = bookListBody.safeParse(req.body);

  if (!body.success)
    return res.status(400).send({ message: "Invalid input." });

  const { author, offset, take, orderBy, authorId } = body.data;

  res.send({
    books: await db.book.findMany({
      take,
      skip: offset,
      where: {
        author: {
          firstName: author?.split(" ")[0],
          lastName: author?.split(" ")[1],
          id: authorId,
        },
      },
      orderBy,
      include: {
        author: true,
      },
    }),
  });
});

const specifyUser = z.object({
  userId: z.string().regex(/^c[a-z0-9]{24}$/),
  bookId: z.string().regex(/^c[a-z0-9]{24}$/),
});

const likeBookBody = z
  .object({
    dislike: z.boolean().default(false),
  })
  .and(specifyUser);
app.post("/likeBook", async (req, res) => {
  const body = likeBookBody.safeParse(req.body);

  if (!body.success)
    return res.status(400).send({ message: "Invalid input." });

  try {
    const { bookId, userId, dislike } = body.data;

    if (!dislike)
      await db.user.update({
        where: {
          id: userId,
        },
        data: {
          likedBooks: {
            connect: {
              id: bookId,
            },
          },
        },
      });
    else
      await db.user.update({
        where: {
          id: userId,
        },
        data: {
          likedBooks: {
            disconnect: {
              id: bookId,
            },
          },
        },
      });

    res.send({ message: "Book liked successfully." });
  } catch {
    res.status(500).send({ message: "An unknown error occurred." });
  }
});

app.post("/borrowBook", async (req, res) => {
  const body = specifyUser.safeParse(req.body);

  if (!body.success)
    return res.status(400).send({ message: "Invalid input." });

  const { bookId, userId } = body.data;

  try {
    const userCheck = await db.user.findFirst({
      where: {
        id: userId,
      },
    });
    console.log(userCheck);
    if (!userCheck)
      return res.status(400).send({ message: "User doesn't exist." });

    const bookCheck = await db.book.findFirst({
      where: {
        id: bookId,
      },
    });

    if (!bookCheck || (bookCheck && bookCheck.holderId))
      return res.status(400).send({
        message:
          "Book doesn't exist or someone is already borrowing it.",
      });

    await db.book.update({
      where: {
        id: bookId,
      },
      data: {
        holderId: userId,
      },
    });

    await db.record.create({
      data: {
        bookId,
        userId,
        borrowedDate: new Date(),
      },
    });

    res.send({ message: "Book borrowed successfully.p" });
  } catch {
    res.status(500).send({ message: "An unknown error occurred." });
  }
});

app.listen(3000, "localhost", () => {
  console.log("listening on http://localhost:3000");
});
