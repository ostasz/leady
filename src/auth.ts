import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authConfig } from './auth.config';

const prisma = new PrismaClient();

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            authorize: async (credentials) => {
                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(6) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data;
                    console.log('Attempting login for:', email);

                    const user = await prisma.user.findUnique({ where: { email } });

                    if (!user) {
                        console.log('User not found in DB');
                        return null;
                    }

                    console.log('User found, verifying password...');
                    const passwordsMatch = await bcrypt.compare(password, user.password);

                    if (passwordsMatch) {
                        if (user.isBlocked) {
                            console.log('User is blocked');
                            throw new Error('Your account has been blocked.');
                        }
                        console.log('Password match! Login successful.');
                        // Update lastLogin
                        try {
                            console.log('Attempting to update lastLogin for user:', user.id);
                            const updateResult = await prisma.user.update({
                                where: { id: user.id },
                                data: { lastLogin: new Date() }
                            });
                            console.log('LastLogin updated successfully:', updateResult.lastLogin);
                        } catch (error) {
                            console.error('Failed to update lastLogin:', error);
                            // Don't block login if update fails
                        }
                        return user;
                    } else {
                        console.log('Password mismatch.');
                    }
                } else {
                    console.log('Invalid credentials format');
                }

                console.log('Login failed');
                return null;
            },
        }),
    ],
    callbacks: {
        ...authConfig.callbacks,
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                // @ts-ignore
                token.role = user.role;
            }
            return token;
        },
        async session({ session, token }) {
            if (token?.id) {
                session.user.id = token.id as string;
                // @ts-ignore
                session.user.role = token.role as string;
            }
            return session;
        },
    },
});
