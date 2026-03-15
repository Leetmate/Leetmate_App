//this is just to change the active pet on the home screen
function changePet() {
    //const pet = document.getElementById("active-pet");
    //pet.style.backgroundImage = "url('../../assets/Animals - Outline/CubicBat.png')";
    //var pet = document.getElementById("active-pet");
    //document.querySelector(".home-hero-pet").classList.add('bat');
    //var element = document.getElementById("active-pet");
    //element.classList.toggle("home-hero-pet.bat");
    let pet = document.getElementById("active-pet");
    pet.classList.remove("home-hero-pet");
    pet.classList.add("home-hero-pet-bat");
}

const petChangeButton = document.getElementById('pet-change-btn');
petChangeButton.addEventListener('click', function () {
    changePet();
    //document.writeln("button clicked");
});