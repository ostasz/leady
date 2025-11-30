'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
    User,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    updateProfile,
    sendEmailVerification
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

type AuthContextType = {
    user: User | null;
    userData: any | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, name?: string) => Promise<void>;
    signOut: () => Promise<void>;
    getAuthHeaders: () => Promise<HeadersInit>;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    userData: null,
    loading: true,
    signIn: async () => { },
    signUp: async () => { },
    signOut: async () => { },
    getAuthHeaders: async () => ({})
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);

            if (firebaseUser) {
                // Fetch user data from Firestore
                const userDocRef = doc(db, 'users', firebaseUser.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    setUserData(userDoc.data());
                } else {
                    // User exists in Auth but not in Firestore - create document
                    console.log('Creating Firestore document for existing Auth user');
                    const newUserData = {
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        name: firebaseUser.displayName || null,
                        role: 'user',
                        isBlocked: false,
                        lastLogin: new Date(),
                        searchCount: 0,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };

                    try {
                        await setDoc(userDocRef, newUserData);
                        setUserData(newUserData);
                        console.log('Firestore user document created successfully');
                    } catch (error) {
                        console.error('Error creating Firestore user document:', error);
                        setUserData(null);
                    }
                }
            } else {
                setUserData(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);

        // Wait a bit for onAuthStateChanged to complete and create Firestore doc
        await new Promise(resolve => setTimeout(resolve, 1000));
    };

    const signUp = async (email: string, password: string, name?: string) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);

        if (name) {
            await updateProfile(userCredential.user, { displayName: name });
        }

        // Send email verification
        const actionCodeSettings = {
            url: window.location.origin + '/auth-action',
            handleCodeInApp: false,
        };

        await sendEmailVerification(userCredential.user, actionCodeSettings);

        // Create user document in Firestore
        const userDocRef = doc(db, 'users', userCredential.user.uid);
        await setDoc(userDocRef, {
            uid: userCredential.user.uid,
            email: email,
            name: name || null,
            role: 'user',
            isBlocked: false,
            lastLogin: new Date(),
            searchCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        });
    };

    const signOut = async () => {
        await firebaseSignOut(auth);
    };

    const getAuthHeaders = async (): Promise<HeadersInit> => {
        if (!user) {
            throw new Error('User not authenticated');
        }

        const token = await user.getIdToken();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    return (
        <AuthContext.Provider value={{ user, userData, loading, signIn, signUp, signOut, getAuthHeaders }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
