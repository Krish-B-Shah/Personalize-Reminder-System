import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  updateProfile
} from 'firebase/auth';
import { auth, db, googleProvider } from './firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { authAPI, tokenUtils } from './services/api';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authMethod, setAuthMethod] = useState('firebase'); // 'firebase' or 'jwt'

  // Check if we should use JWT authentication
  const shouldUseJWT = () => {
    return process.env.REACT_APP_USE_JWT === 'true' || tokenUtils.getToken();
  };

  async function signup(email, password, username) {
    try {
      setError(null);
      
      if (shouldUseJWT()) {
        // Use new JWT authentication
        const result = await authAPI.register({
          email,
          password,
          username,
          role: 'student'
        });
        
        setAuthMethod('jwt');
        setCurrentUser(result.user);
        setUserProfile(result.user);
        return result;
      } else {
        // Fallback to Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        await updateProfile(user, { displayName: username });
        
        await setDoc(doc(db, "users", user.uid), {
          username,
          email,
          displayName: username,
          createdAt: serverTimestamp()
        });
        
        setAuthMethod('firebase');
        return userCredential;
      }
    } catch (error) {
      console.error("Error in signup:", error);
      setError(error.message);
      throw error;
    }
  }

  async function loginWithGoogle() {
    try {
      setError(null);
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (!userDoc.exists()) {
        await setDoc(doc(db, "users", user.uid), {
          username: user.displayName,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: serverTimestamp(),
          provider: 'google'
        });
      }
      
      setAuthMethod('firebase');
      return result;
    } catch (error) {
      console.error("Error in Google sign-in:", error);
      setError(error.message);
      throw error;
    }
  }

  async function login(email, password) {
    try {
      setError(null);
      
      if (shouldUseJWT()) {
        // Use new JWT authentication
        const result = await authAPI.login(email, password);
        
        setAuthMethod('jwt');
        setCurrentUser(result.user);
        setUserProfile(result.user);
        return result;
      } else {
        // Fallback to Firebase Auth
        const result = await signInWithEmailAndPassword(auth, email, password);
        setAuthMethod('firebase');
        return result;
      }
    } catch (error) {
      console.error("Error in login:", error);
      setError(error.message);
      throw error;
    }
  }

  async function logout() {
    try {
      setError(null);
      
      if (authMethod === 'jwt') {
        await authAPI.logout();
        tokenUtils.clearTokens();
      } else {
        await signOut(auth);
      }
      
      setCurrentUser(null);
      setUserProfile(null);
      setAuthMethod('firebase');
    } catch (error) {
      console.error("Error in logout:", error);
      setError(error.message);
      throw error;
    }
  }

  async function getUserProfile(uid) {
    try {
      if (authMethod === 'jwt') {
        const profile = await authAPI.getProfile();
        setUserProfile(profile.user);
        return profile.user;
      } else {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
          const profile = userDoc.data();
          setUserProfile(profile);
          return profile;
        }
      }
      return null;
    } catch (error) {
      console.error("Error getting user profile:", error);
      setError(error.message);
      return null;
    }
  }

  // Enhanced auth state management
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      try {
        if (user && authMethod === 'firebase') {
          setCurrentUser(user);
          await getUserProfile(user.uid);
        } else if (tokenUtils.getToken() && !tokenUtils.isTokenExpired(tokenUtils.getToken())) {
          // JWT authentication - verify token
          try {
            const profile = await authAPI.getProfile();
            setCurrentUser(profile.user);
            setUserProfile(profile.user);
            setAuthMethod('jwt');
          } catch (error) {
            // Token invalid, clear it
            tokenUtils.clearTokens();
            setCurrentUser(null);
            setUserProfile(null);
          }
        } else {
          setCurrentUser(null);
          setUserProfile(null);
        }
      } catch (err) {
        console.error("Error in auth state change:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [authMethod]);

  // Check for JWT token on app load
  useEffect(() => {
    const checkJWTAuth = async () => {
      const token = tokenUtils.getToken();
      if (token && !tokenUtils.isTokenExpired(token)) {
        try {
          const profile = await authAPI.getProfile();
          setCurrentUser(profile.user);
          setUserProfile(profile.user);
          setAuthMethod('jwt');
        } catch (error) {
          tokenUtils.clearTokens();
        }
      }
      setLoading(false);
    };

    if (!loading) {
      checkJWTAuth();
    }
  }, []);

  const value = {
    currentUser,
    userProfile,
    login,
    signup,
    logout,
    loginWithGoogle,
    loading,
    error,
    authMethod,
    getUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;