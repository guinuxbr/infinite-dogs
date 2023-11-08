const imageContainer = document.querySelector("#image-container");
const loader = document.querySelector("#loader");

let ready = false;
let imagesLoaded = 0;
let totalImages = 0;
let photosArray = [];

// Dog API
let imagesToLoad = 15; // For performance reasons, just load 10 images
const apiURL = `https://dog.ceo/api/breeds/image/random/${imagesToLoad}`;

// Check all images were loaded
function imageLoaded() {
    imagesLoaded++;
    if (imagesLoaded === totalImages) {
        ready = true;
        loader.hidden = true;
        imagesToLoad = 15; // Once the first 10 messages were loaded and the scroll is at the bottom, load 10 more images
    }
}

// Helper Function to Set Attributes on DOM Elements
function setAttributes(element, attributes) {
    for (const key in attributes) {
        element.setAttribute(key, attributes[key]);
    }
}

// Create Elements for links & photos, then add to DOM
function displayPhotos() {
    imagesLoaded = 0;
    totalImages = photosArray.message.length;

    photosArray.message.forEach((photo) => {
        // Create <a> to link to Dog API
        const uiA = document.createElement("a");
        setAttributes(uiA, {
            href: photo,
            target: "_blank",
        });

        // Create <img> to to place the photos
        const uiImg = document.createElement("img");
        const split = photo.split("/");
        const breed = split[4];

        setAttributes(uiImg, {
            src: photo,
            title: breed,
        });

        //Check when images is finished loading
        uiImg.addEventListener("load", imageLoaded);

        // Put <img> inside <a>, then insert both into imageContainer
        uiA.appendChild(uiImg);
        imageContainer.appendChild(uiA);
    });
}

// Get photos from Dog API
async function getPhotos() {
    try {
        const response = await fetch(apiURL);
        photosArray = await response.json();
        displayPhotos();
    } catch (error) {
        console.log(error);
    }
}

// Check if scroll is near the bottom, then load more photos
window.addEventListener("scroll", () => {
    if (
        window.innerHeight + window.scrollY >=
            document.body.offsetHeight - 1000 &&
        ready
    ) {
        ready = false;
        getPhotos();
    }
});

// On load
getPhotos();
