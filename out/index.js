var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import express from "express";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import cors from "cors";
const db = new PrismaClient();
const app = express();
app.use(cors({
    origin: "*",
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());
app.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.status(418).send({ message: "Hello, world!" });
}));
const loginBody = z.object({
    username: z.string(),
    password: z.string(),
});
app.post("/login", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const body = loginBody.safeParse(req.body);
    if (!body.success)
        return res.status(400).send({ error: "Invalid input." });
    try {
        const { username, password } = body.data;
        const user = yield db.user.findFirst({
            where: {
                username,
            },
            select: {
                id: true,
                password: true,
            },
        });
        if (!user ||
            (user && !(yield bcrypt.compare(password, user.password))))
            return res.status(404).send({
                message: "Incorrect username and password combination.",
            });
        res.send({ message: "Login successful", userId: user.id });
    }
    catch (_a) {
        res.status(500).send({ message: "An unknown error occurred." });
    }
}));
app.post("/register", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const body = loginBody.safeParse(req.body);
    if (!body.success)
        return res.status(400).send({ message: "Invalid input." });
    const { password, username } = body.data;
    const hashedPassword = yield bcrypt.hash(password, 10);
    try {
        const userCheck = yield db.user.findFirst({
            where: {
                username,
                password: hashedPassword,
            },
        });
        if (userCheck)
            return res
                .status(409)
                .send({ message: "User already exists." });
        const newUser = yield db.user.create({
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
    }
    catch (_a) {
        res.status(500).send({ message: "An unknown error occurred." });
    }
}));
const bookListBody = z.object({
    author: z
        .string()
        .regex(/^[A-Z][a-z]+ [A-Z][a-z]+$/)
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
app.get("/books", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const body = bookListBody.safeParse(req.body);
    if (!body.success)
        return res.status(400).send({ message: "Invalid input." });
    const { author, offset, take, orderBy } = body.data;
    res.send({
        books: yield db.book.findMany({
            take: take,
            skip: offset,
            where: {
                author: {
                    firstName: author === null || author === void 0 ? void 0 : author.split(" ")[0],
                    lastName: author === null || author === void 0 ? void 0 : author.split(" ")[1],
                },
            },
            orderBy,
            include: {
                author: true,
            },
        }),
    });
}));
app.listen(3000, "localhost", () => {
    console.log("listening on http://localhost:3000");
});