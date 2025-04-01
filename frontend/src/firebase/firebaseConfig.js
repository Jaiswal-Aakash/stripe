import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';   
const firebaseConfig = {
    apiKey: "AIzaSyDnwlzn0NUwpQ0QQUcxoDA0GL08bP2am3M",
    authDomain: "stripe-subscription-5d6d7.firebaseapp.com",
    projectId: "stripe-subscription-5d6d7",
    storageBucket: "stripe-subscription-5d6d7.firebasestorage.app",
    messagingSenderId: "913112822297",
    appId: "1:913112822297:web:7d96e975c8f22bc7b83088"
};
 if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig); 
    }
    export default firebase;
