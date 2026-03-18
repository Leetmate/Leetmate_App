// Adding Pet Logic (for testing only!)
//const homeFile = require('../home/home.js');
// <script type="module" src="../home/home.js"></script>
// import {db, uid} from '../../home/home.js';

//https://stackoverflow.com/questions/19635077/adding-objects-to-array-in-localstorage

//var auth = typeof firebase !== 'undefined' ? firebase.auth() : null;
//var db = typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore() : null;

// local storage keys used to store values
//const PET_KEY = "leetmate_pets";

/*function addBat(value) {
    const batImg = new Image();
    batImg.src = '../../../../asset/sprite/CubicBat.png';
    batImg.alt = 'Bat';
    const allPets = localStorage.getItem("pets");
    if(allPets == null)
    {
        allPets = [];
    }
    var entry = {
        "pet_name": "Batty",
        "pet_level": 1,
        "pet_hp": 100,
        "pet_atk": 100,
        "pet_def": 100,
        "pet_img": batImg
    };
    localStorage.setItem("entry", JSON.stringify(entry));
    existingPets.push(entry);
    localStorage.setItem("allPets", JSON.stringify(existingPets));
}*/

/*const addBatButton = document.getElementById('add-bat-btn');
addBatButton.addEventListener('click', function() {
    const allPets = localStorage.getItem('pets');
    if(allPets == null)
    {
        allPets = [];
    }
    allPets.append("Batsy");
    localStorage.setItem("pets", allPets);
});*/

/*const addBatButton = document.getElementById('add-bat-btn');
addBatButton.addEventListener('click', function(db, uid) {   
    var un = db
    .collection("users")
    .doc(uid)
    .get()
    .then((snap)=>{
        const data = snap.data();
        return data.username;
    })
    document.writeln(String(un))
});*/

//note, Joon said that the db uid that he used in his savexptofirestore function was passed from the home.js
const addBatButton = document.getElementById('add-bat-btn');
addBatButton.addEventListener('click', function() {
    //var db = homeFile.db;
    //var uid = homeFile.uid;
    var un = db
    .collection("users")
    .doc(uid)
    .get()
    .then((snap) => {
        const data = snap.data();
        return data.username;
    })
    document.writeln(String(un));
});