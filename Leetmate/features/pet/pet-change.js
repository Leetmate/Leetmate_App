//this is just to change the active pet on the home screen
function changePet() {
    //const pet = document.getElementById("active-pet");
    //pet.style.backgroundImage = "url('../../assets/spritesheets/CubicBat.png')";
    //var pet = document.getElementById("active-pet");
    //document.querySelector(".home-hero-pet").classList.add('bat');
    //var element = document.getElementById("active-pet");
    //element.classList.toggle("home-hero-pet.bat");
    let pet = document.getElementById("active-pet");
    let petName = document.getElementById("pet-name-display");
    if (pet.classList != "home-hero-pet") {
        pet.classList.remove("home-hero-pet-bat");
        pet.classList.add("home-hero-pet");
        petName.innerText = "Fluffy Cat";

    }
    else
    {
        pet.classList.remove("home-hero-pet");
        pet.classList.add("home-hero-pet-bat");
        petName.innerText = "Funny Bat";
    }
}

const petChangeButton = document.getElementById('pet-change-btn');
petChangeButton.addEventListener('click', function () {
    changePet();
    //document.writeln("button clicked");
});
