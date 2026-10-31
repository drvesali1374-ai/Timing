import NextAuth from "next-auth";
import { authOptions } from "@/modules/identity/infrastructure/nextauth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
