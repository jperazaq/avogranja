import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
    collection,
    query,
    orderBy,
    limit,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyB3A6DOrOoTtzwVKIDyZtSDjwAA7s56m_c",
    authDomain: "avogranja-acbfd.firebaseapp.com",
    projectId: "avogranja-acbfd",
    storageBucket: "avogranja-acbfd.firebasestorage.app",
    messagingSenderId: "503675322505",
    appId: "1:503675322505:web:d20423f8751a9e32374658",
    measurementId: "G-RPXN4KWYR3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// Auth Functions
export const registerUser = async (email, password, nickname) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        // Create initial user doc
        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            nickname: nickname || "Granjero",
            highScore: 0,
            createdAt: serverTimestamp()
        });
        return user;
    } catch (error) {
        throw error;
    }
};

export const loginUser = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        throw error;
    }
};

export const logoutUser = () => signOut(auth);

export const subscribeToAuthChanges = (callback) => {
    onAuthStateChanged(auth, callback);
};

// Firestore Functions
export const getUserStats = async (uid) => {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data();
    } else {
        // If doc doesn't exist for some reason, create it
        const initialData = {
            highScore: 0,
            email: auth.currentUser.email
        };
        await setDoc(docRef, initialData);
        return initialData;
    }
};

export const saveUserHighScore = async (uid, newScore) => {
    const docRef = doc(db, "users", uid);
    // Let errors propagate to caller
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const currentHigh = docSnap.data().highScore || 0;
        if (newScore > currentHigh) {
            await updateDoc(docRef, {
                highScore: newScore,
                lastUpdated: serverTimestamp()
            });
            return newScore; // New high score
        }
        return currentHigh; // Old high score kept
    }
};

export const getLeaderboard = async () => {
    try {
        const q = query(collection(db, "users"), orderBy("highScore", "desc"), limit(10));
        const querySnapshot = await getDocs(q);
        const leaderboard = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            leaderboard.push({
                nickname: data.nickname || "Anónimo",
                score: data.highScore || 0
            });
        });
        return leaderboard;
    } catch (error) {
        // console.error("Error fetching leaderboard:", error);
        return [];
    }
};

export const savePuzzleStats = async (uid, level, sessionTimeSeconds) => {
    const docRef = doc(db, "users", uid);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            const currentMaxLevel = data.puzzleMaxLevel || 0;
            const currentTotalTime = data.puzzleTotalTime || 0;

            const updates = {
                puzzleTotalTime: currentTotalTime + sessionTimeSeconds,
                lastUpdated: serverTimestamp()
            };

            if (level > currentMaxLevel) {
                updates.puzzleMaxLevel = level;
            }

            await updateDoc(docRef, updates);
        }
    } catch (error) {
        console.error("Error saving puzzle stats:", error);
    }
};

export const getPuzzleLeaderboard = async () => {
    try {
        // Order by Max Level first, then maybe something else? 
        // For now just Max Level.
        const q = query(collection(db, "users"), orderBy("puzzleMaxLevel", "desc"), limit(10));
        const querySnapshot = await getDocs(q);
        const leaderboard = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            leaderboard.push({
                nickname: data.nickname || "Anónimo",
                level: data.puzzleMaxLevel || 1,
                time: data.puzzleTotalTime || 0
            });
        });
        return leaderboard;
    } catch (error) {
        // console.error("Error fetching puzzle leaderboard:", error);
        return [];
    }
};

export const syncPuzzleStats = async (uid, localLevel) => {
    const docRef = doc(db, "users", uid);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();

            // If field missing OR local level is higher than cloud logic
            const cloudLevel = data.puzzleMaxLevel || 0;

            if (cloudLevel === 0 || localLevel > cloudLevel) {
                await updateDoc(docRef, {
                    puzzleMaxLevel: localLevel,
                    puzzleTotalTime: data.puzzleTotalTime || 0, // Initialize if missing
                    lastUpdated: serverTimestamp()
                });
            }
        }
    } catch (error) {
        console.error("Error syncing puzzle stats:", error);
    }
};
