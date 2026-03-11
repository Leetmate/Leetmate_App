// Adding Pet Logic (for testing only!)

//https://stackoverflow.com/questions/19635077/adding-objects-to-array-in-localstorage

//var auth = typeof firebase !== 'undefined' ? firebase.auth() : null;
var db = typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore() : null;

// local storage keys used to store values
//const PET_KEY = "leetmate_pets";

/*function addBat(value) {
    const batImg = new Image();
    batImg.src = '../../sprite_web/Animals - Outline/CubicBat.png';
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
  addBatButton.addEventListener('click', function () {
      const batImg = new Image();
    batImg.src = '../../sprite_web/Animals - Outline/CubicBat.png';
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
    //existingPets.push(entry);
    existingPets.push("Batsy")
    localStorage.setItem("pets", JSON.stringify(existingPets));
});*/

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

const addBatButton = document.getElementById('add-bat-btn');
addBatButton.addEventListener('click', function() {
    //window.location.href = "../home/index.html" //this is just to check that the button's registering clicks (it does)
    //localStorage.setItem("level", 2);
    //documenbluet.writeln("Text appears!"); //this erased all the text on the screen and replaced it
    //var un = db.collection('users').doc(uid).get().then(doc=>doc.get('username'));
    //var un = localStorage.getItem("leetmate_level"); //this works? but it gets the data that's shown on the extension home page. not what's stored in the firebase.
    const userRef = db.collection('users').doc(uid);
    const doc = cityRef.get();
    var un = doc.data().username;
    document.writeln(String(un));    
});