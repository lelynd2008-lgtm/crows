// CARNIVAL OF CROWS
// Main game file - Controls game logic and rendering

// Game configuration
const NIGHT_LENGTH_MS = 6 * 60 * 1000;
const GRACE_PERIOD_MS = 90 * 1000; // 1.5 minutes grace period for night 1
const WIN_GAME_NIGHT = 5; // Night when player wins the game

// Game state constants
const STATE_PLAYING = 'playing';
const STATE_WIN_NIGHT = 'win_night';
const STATE_WIN_GAME = 'win_game';
const STATE_JUMPSCARE = 'jumpscare';
const STATE_END = 'end';
const POWER_DRAIN_BASE = 0.1;          // Reduced base power drain
const POWER_DRAIN_CAM = 0.2;           // Reduced camera power drain
const DOOR_DRAIN = 0.15;               // Reduced door power drain
const SCREECH_COOLDOWN_MS = 3000;
const SCREECH_POWER_DRAIN = 5;         // Reduced power consumed per screech

// Animatronic display sizes
const MARKER_SIZE = 80; // Default size (keep for backward compatibility)
const TILLY_SIZE = 300;        // Larger size for Tilly
const BALLOONA_BODY_SIZE = 300;      // Body size
const BALLOONA_HEAD_MIN_SIZE = 300;   // Starting head size (smaller than body)
const BALLOONA_HEAD_MAX_SIZE = 500;  // Max head size (larger than body but not too extreme)
const CROWMAN_SIZE = 110;      // Larger size for Crowman
const DIZZY_SIZE = 300;         // Larger size for Dizzy

const nightConfig = {
  1: { tilly: 2, balloona: 0, crowman: 1, dizzy: 4 },
  2: { tilly: 7, balloona: 1, crowman: 2, dizzy: 1 },
  3: { tilly: 7, balloona: 3, crowman: 4, dizzy: 2 },
  4: { tilly: 10, balloona: 6, crowman: 6, dizzy: 4 },
  5: { tilly: 14, balloona: 10, crowman: 12, dizzy: 18 },
};

let imgOffice, imgLeftDoor, imgRightDoor, imgRightDoorBroken, imgFinalJumpscare;
let sndFinalJumpscare; // Final jumpscare sound
// Camera views with different door states
let imgCam3, imgCam3DoorClosed, imgCam5, imgCam5DoorClosed;
let savedNight = 1; // progress tracker
let imgCrowmanDoor, imgCrowmanScare;
let sndPowerout, sndScreech, sndJumpscare, sndCameraStatic, sndFan, sndDoorClose, sndPhoneCall, sndPop;
let imgDeathScreen;
let imgTillyScare, imgDizzyScare;
let imgTilly, imgBalloona, imgBalloonaHead, imgCrowBlocked, imgDizzy; // new markers
let cameraStaticPlaying = false;
let fanPlaying = false;
let phoneCallPlaying = false;
const PHONE_CALL_FILES = {
  1: "phone_night1.mp3",
  2: "phone_night2.mp3",
  3: "phone_night3.mp3",
  4: "phone_night4.mp3",
  5: "phone_night5.mp3"
};

function preload() {
  imgOffice    = loadImage("office.png");
  imgLeftDoor  = loadImage("leftdoor.png");
  imgRightDoor = loadImage("rightdoor.png");
  imgRightDoorBroken = loadImage("rightdoor_broken.png");
  imgCrowmanDoor     = loadImage("crowman_door.png");
  imgCrowmanScare    = loadImage("crowman_scare.png");
  sndPowerout        = loadSound("powerout_song.mp3");
  sndScreech        = loadSound("screech.wav");
  sndJumpscare      = loadSound("jumpscare.wav");
  sndFinalJumpscare = loadSound("final_jumpscare.wav"); // Load final jumpscare sound
  sndCameraStatic   = loadSound("camera_static.wav");
  sndFan            = loadSound("fan.wav");
  sndDoorClose      = loadSound("door_close.wav"); // Load door close sound
  sndPop            = loadSound("pop.wav"); // Load pop sound for Balloona
  imgDeathScreen     = loadImage("death_screen.png");
  imgTillyScare     = loadImage("tilly_scare.png");
  imgDizzyScare     = loadImage("dizzy_scare.png");
  imgDizzy         = loadImage("dizzy.png");
  // Load camera views with door states
  imgCam3           = loadImage("cam3.png");
  imgCam3DoorClosed = loadImage("cam3_door_closed.png");
  imgCam5           = loadImage("cam5.png");
  imgCam5DoorClosed = loadImage("cam5_door_closed.png");

  // New animatronic marker images
  imgTilly        = loadImage("tilly.png");
  imgBalloona     = loadImage("balloona_body.png");
  imgBalloonaHead = loadImage("balloona_head.png");
  imgCrowBlocked  = loadImage("crow_blocked.png"); // Image for blocked camera view
  imgFinalJumpscare = loadImage("final_jumpscare.png"); // Final jumpscare image

  camImages = [
    loadImage("cam1.png"),
    loadImage("cam2.png"),
    loadImage("cam3.png"),
    loadImage("cam4.png"),
    loadImage("cam5.png"),
  ];
}

// Audio management

function toggleCameraStatic(show) {
  if (show && !cameraStaticPlaying) {
    if (sndCameraStatic) {
      sndCameraStatic.loop();
      sndCameraStatic.setVolume(0.4);
    }
    cameraStaticPlaying = true;
  } else if (!show && cameraStaticPlaying) {
    if (sndCameraStatic) {
      sndCameraStatic.stop();
    }
    cameraStaticPlaying = false;
  }
}

function startFan() {
  if (sndFan && !fanPlaying) {
    sndFan.loop();
    sndFan.setVolume(0.3);
    fanPlaying = true;
  }
}

function stopFan() {
  if (sndFan && fanPlaying) {
    sndFan.stop();
    fanPlaying = false;
  }
}

// Game state management
function createBaseGameState() {
  return {
    state: "menu",
    showCams: false,
    selectedCam: -1,
    leftDoorClosed: false,
    rightDoorClosed: false,
    power: 100,
    lastPowerDrainTime: 0,
    lastScreechTime: -Infinity,
    screechCount: 0,
    nightStartTime: 0,
    currentNight: 1,
    gameoverMsg: "",
    rightDoorBroken: false,
    pausedForPhoneCall: false,
  };
}

let game = createBaseGameState();

game.poweroutStart = 0; // timestamp when power-out begins
game.nightStartTime = 0; // Track when the night started

// Game state tracking
let gameState = STATE_PLAYING;
let winGameTimer = 0;
let finalJumpscareTimer = 0;
let showEndText = false;

const camConfig = [
  { label: "Cam 1" }, { label: "Cam 2" }, { label: "Cam 3" },
  { label: "Cam 4" }, { label: "Cam 5" }
];
let cams = [];
let camImages = [];
let buttons = {};
let animatronics = {};

function setup() {
  createCanvas(600, 400);
  const offsetX = width - 225;
  const offsetY = height - 145;
  const horizontalSpacing = 65;
  const verticalSpacing = 42;

  cams = [
    { id: 0, label: "Cam 1", x: offsetX + horizontalSpacing, y: offsetY },
    { id: 1, label: "Cam 2", x: offsetX, y: offsetY + verticalSpacing },
    { id: 2, label: "Cam 3", x: offsetX, y: offsetY + verticalSpacing * 2 },
    { id: 3, label: "Cam 4", x: offsetX + horizontalSpacing * 2, y: offsetY + verticalSpacing },
    { id: 4, label: "Cam 5", x: offsetX + horizontalSpacing * 2, y: offsetY + verticalSpacing * 2 },
  ].map(c => ({ ...c, w: 60, h: 30 }));

  buttons = {
    menuNew: { x: width / 2 - 140, y: height / 2 + 20, w: 120, h: 50 },
    menuContinue: { x: width / 2 + 20, y: height / 2 + 20, w: 120, h: 50 },
    screech: { x: width - 60, y: 20, w: 40, h: 40 },
    deflate: { x: width / 2 + 50, y: height / 2 + 30, w: 80, h: 30 },
    mute: { x: width - 40, y: 5, w: 25, h: 25 }
  };
}

function draw() {
  // Ensure phone call audio never plays in non-gameplay screens (menu, win night/game)
  if ((game.state === "menu" || gameState === STATE_WIN_GAME || gameState === STATE_WIN_NIGHT) && phoneCallPlaying) {
    stopPhoneCall();
  }
  background(30);
  
  // Handle fan sound based on game state
  if (gameState === STATE_PLAYING && game.state === "playing") {
    // Only play fan sound during active gameplay (not in cams or phone call)
    if (game.showCams || game.pausedForPhoneCall) {
      stopFan();
    } else if (!fanPlaying) {
      startFan();
    }
  } else {
    // Stop fan in all other states (menu, win screens, etc.)
    if (fanPlaying) {
      stopFan();
    }
  }
  
  // Draw phone call UI if active
  if (phoneCallPlaying) {
    fill(0, 0, 0, 200);
    rect(0, 0, width, 40);
    fill(255);
    textSize(20);
    textAlign(CENTER, CENTER);
    text("Phone Call... (Press 'M' to mute)", width/2, 20);
    // Draw mute button (small X)
    drawButton(buttons.mute, "X");
  }
  
  switch(gameState) {
    case STATE_PLAYING:
      if (game.state === "menu") {
        drawMenu();
      } else if (game.state === "playing") {
        runGameLoop();
      } else if (game.state === "powerout") {
        drawPowerOut();
      } else if (game.state === "jumpscare") {
        drawJumpscare();
      } else {
        showGameOver();
      }
      break;
      
    case STATE_WIN_NIGHT:
      drawWinNight();
      break;
      
    case STATE_WIN_GAME:
      drawWinGame();
      break;
      
    case STATE_JUMPSCARE:
      drawFinalJumpscare();
      break;
      
    case STATE_END:
      drawEndScreen();
      break;
  }
}

function drawWinNight() {
  // Render night completion screen
  background(0);
  fill(255);
  textSize(40);
  textAlign(CENTER, CENTER);
  text('6 AM - You Survived!', width/2, height/2 - 50);
  textSize(24);
  text('Click to continue to Night ' + (game.currentNight + 1), width/2, height/2 + 50);
}

// Jumpscare state
let jumpscareSoundPlayed = false;
let activeJumpscareSound = null;
let endScreenStartTime = 0;
// Timestamp when the \"Night Complete\" screen was first shown. Used to avoid
// accidental clicks carrying over from gameplay and instantly skipping the
// screen.
let winNightStartTime = 0;

function drawWinGame() {
  // Render game completion screen
  background(0, 100, 0);
  fill(255);
  textSize(40);
  textAlign(CENTER, CENTER);
  text('CONGRATULATIONS!', width/2, height/2 - 50);
  textSize(24);
  text('You survived all five nights!', width/2, height/2 + 20);
  
  // Start final jumpscare after 10 seconds
  if (millis() - winGameTimer > 10000) {
    if (!jumpscareSoundPlayed) {
      // Play final jumpscare sound if available
      if (sndFinalJumpscare) {
        // Stop any currently playing jumpscare sound
        if (activeJumpscareSound) {
          activeJumpscareSound.stop();
        }
        // Set and play the new sound
        activeJumpscareSound = sndFinalJumpscare;
        activeJumpscareSound.play();
        // Set a timeout to automatically stop the sound after 2 seconds (duration of jumpscare)
        setTimeout(() => {
          if (activeJumpscareSound && activeJumpscareSound.isPlaying()) {
            activeJumpscareSound.stop();
          }
        }, 2000);
        // Wait for the sound to start before showing the jumpscare
        setTimeout(() => {
          gameState = STATE_JUMPSCARE;
          finalJumpscareTimer = millis();
        }, 100);
      } else if (sndJumpscare) {
        // Fallback to regular jumpscare sound
        // Stop any currently playing jumpscare sound
        if (activeJumpscareSound) {
          activeJumpscareSound.stop();
        }
        // Set and play the new sound
        activeJumpscareSound = sndJumpscare;
        activeJumpscareSound.play();
        // Set a timeout to automatically stop the sound after 2 seconds (duration of jumpscare)
        setTimeout(() => {
          if (activeJumpscareSound && activeJumpscareSound.isPlaying()) {
            activeJumpscareSound.stop();
          }
        }, 2000);
        // Show the jumpscare after a short delay
        setTimeout(() => {
          gameState = STATE_JUMPSCARE;
          finalJumpscareTimer = millis();
        }, 100);
      } else {
        // No sound available, just show the jumpscare
        gameState = STATE_JUMPSCARE;
        finalJumpscareTimer = millis();
      }
      jumpscareSoundPlayed = true;
    }
  }
}

function drawFinalJumpscare() {
  // Render final jumpscare
  if (imgFinalJumpscare) {
    // Center and scale the image to fit the canvas while maintaining aspect ratio
    let scale = min(width / imgFinalJumpscare.width, height / imgFinalJumpscare.height);
    let imgWidth = imgFinalJumpscare.width * scale;
    let imgHeight = imgFinalJumpscare.height * scale;
    let x = (width - imgWidth) / 2;
    let y = (height - imgHeight) / 2;
    
    image(imgFinalJumpscare, x, y, imgWidth, imgHeight);
  } else {
    // Fallback rendering
    background(255, 0, 0);
    fill(0);
    textSize(60);
    textAlign(CENTER, CENTER);
    text('GOTCHA!', width/2, height/2);
  }
  
  // After 2 seconds of jumpscare, go to end screen
  if (millis() - finalJumpscareTimer > 2000) {
    // Stop the jumpscare sound if it's still playing
    if (activeJumpscareSound && activeJumpscareSound.isPlaying()) {
      activeJumpscareSound.stop();
      activeJumpscareSound = null;
    }
    gameState = STATE_END;
  }
}

function drawEndScreen() {
  // Initialize end screen timer
  if (endScreenStartTime === 0) {
    endScreenStartTime = millis();
  }
  
  // Render end screen
  background(0);
  fill(255);
  textSize(40);
  textAlign(CENTER, CENTER);
  text("It fits perfectly, doesn't it", width/2, height/2);
  
  // Return to menu after delay
  if (millis() - endScreenStartTime > 3000) {
    // Reset the game state to menu
    gameState = STATE_PLAYING;
    game.state = 'menu';
    endScreenStartTime = 0; // Reset for next time
  }
}

function drawPowerOut() {
  const elapsed = millis() - game.poweroutStart;
  background(0); // dark office
  if (imgCrowmanDoor) image(imgCrowmanDoor, 0, 0, width, height);
  // Play power out song once
  if (elapsed < 100 && !sndPowerout.isPlaying()) sndPowerout.play();
  // Trigger jumpscare after delay
  if (elapsed > 8000) {
    triggerJumpscare(imgCrowmanScare, "Crowman got you!", 2000);
  }
}

function drawJumpscare() {
  if (game.jumpscareImg) image(game.jumpscareImg, 0, 0, width, height);
}

function drawMenu() {
  fill(255);
  textSize(48);
  textAlign(CENTER, CENTER);
  text("Carnival of Crows", width / 2, height / 2 - 20);
  drawButton(buttons.menuNew, "NEW GAME");
  drawButton(buttons.menuContinue, "CONTINUE", savedNight > 1);
}

function mousePressed() {
  // Handle mute button click during phone call
  // Phone call muted with 'M' key (see keyPressed)
  
  if (gameState === STATE_WIN_NIGHT) {
    // Require a short delay so a click from gameplay doesn't immediately skip
    if (millis() - winNightStartTime < 500) {
      return;
    }
    // Start next night
    startNight(game.currentNight + 1);
    return;
  } else if (gameState === STATE_END) {
    // Restart game from menu
    gameState = STATE_PLAYING;
    game.state = "menu";
    return;
  }
  
  if (game.state === "menu") {
    if (hitTest(buttons.menuNew)) {
      startNight(1);
    } else if (savedNight > 1 && hitTest(buttons.menuContinue)) {
      startNight(savedNight);
    }
  } else if (game.state === "gameover" && game.buttons) {
    if (hitTest(game.buttons.playAgain)) {
      // Restart current night
      startNight(game.currentNight);
    } else if (hitTest(game.buttons.menu)) {
      // Return to main menu
      gameState = STATE_PLAYING;
      game.state = "menu";
    }
  } else {
    handleGameplayClick();
  }
}

function keyPressed() {
  // Handle phone call skip with 'M' key
  if (phoneCallPlaying && (key === 'm' || key === 'M')) {
    stopPhoneCall();
    return;
  }
  
  // Handle camera switching (1-5 keys)
  if (gameState === STATE_PLAYING && game.state === 'playing' && key >= '1' && key <= '5') {
    const camNum = parseInt(key) - 1;
    if (camNum >= 0 && camNum < cams.length) {
      game.selectedCam = camNum;
      game.showCams = true;
      toggleCameraStatic(true);
      stopFan();
    }
    return;
  }
  
  // Debug: Press P to skip to next night
  if (key === 'p' || key === 'P') {
    if (gameState === STATE_PLAYING && game.state === 'playing') {
      if (game.currentNight >= WIN_GAME_NIGHT) {
        gameState = STATE_WIN_GAME;
        winGameTimer = millis();
      } else {
        gameState = STATE_WIN_NIGHT;
      }
      return;
    }
  }
  
  // Only process game controls if we're in the playing state
  if (gameState === STATE_PLAYING && game.state === 'playing') {
    if (key === "c" || key === "C") {
      game.showCams = !game.showCams;
      toggleCameraStatic(game.showCams);
      if (game.showCams) {
        stopFan();
      } else {
        startFan();
      }
      return;
    }
    if (key === "a" || key === "A") {
      game.leftDoorClosed = !game.leftDoorClosed;
      if (sndDoorClose) sndDoorClose.play();
      return;
    }
    if (key === "d" || key === "D") {
      game.rightDoorClosed = !game.rightDoorClosed;
      if (sndDoorClose) sndDoorClose.play();
      return;
    }
  }
}

// ────────────────────────────────────────────────────
// GAME LOOP & HUD

function startPhoneCall(night) {
  // Stop any currently playing call
  if (sndPhoneCall) {
    sndPhoneCall.stop();
  }
  
  // Get the appropriate phone call file for this night (default to night 5 if night > 5)
  const phoneFile = PHONE_CALL_FILES[Math.min(night, 5)] || PHONE_CALL_FILES[5];
  
  // Pause the fan during phone call
  if (fanPlaying) {
    stopFan();
  }
  
  // Load and play the phone call
  sndPhoneCall = loadSound(phoneFile, () => {
    if (sndPhoneCall) {
      sndPhoneCall.play();
      phoneCallPlaying = true;
      
      // Set a timeout to automatically end the call when it's done
      setTimeout(stopPhoneCall, sndPhoneCall.duration() * 1000);
    }
  });
}

function stopPhoneCall() {
  if (sndPhoneCall) {
    sndPhoneCall.stop();
    sndPhoneCall = null;
  }
  phoneCallPlaying = false;
  
  // Restart fan after phone call ends if we're not in camera view
  if (!game.showCams && game.state === 'playing' && !fanPlaying) {
    startFan();
  }
}

function startNight(n) {
  // Stop all sounds when starting a new night
  if (sndPowerout && sndPowerout.isPlaying()) sndPowerout.stop();
  if (sndScreech && sndScreech.isPlaying()) sndScreech.stop();
  if (sndJumpscare && sndJumpscare.isPlaying()) sndJumpscare.stop();
  if (sndCameraStatic && cameraStaticPlaying) {
    sndCameraStatic.stop();
    cameraStaticPlaying = false;
  }
  if (sndFan && fanPlaying) {
    sndFan.stop();
    fanPlaying = false;
  }
  
  // Reset game state
  game = createBaseGameState();
  game.state = "playing";
  game.currentNight = n;
  savedNight = n;
  game.nightStartTime = millis(); // Track when the night starts
  gameState = STATE_PLAYING; // Reset game state
  // Don't start fan here - let the draw loop handle it based on game state
  animatronics = {
    tilly: new Tilly(nightConfig[n].tilly),
    balloona: new Balloona(nightConfig[n].balloona),
    crowman: new Crowman(nightConfig[n].crowman),
    dizzy: new Dizzy(nightConfig[n].dizzy)
  };
  
  // Start the fan
  startFan();
  
  // Start the night with a phone call
  startPhoneCall(n);
  
  // Reset camera and doors
  game.showCams = false;
  game.leftDoorClosed = false;
  game.rightDoorClosed = false;
  
  // Start night music (if sound is loaded)
  try {
    if (typeof sndNightMusic !== 'undefined' && sndNightMusic) {
      sndNightMusic.loop();
    }
  } catch (e) {
    console.log('Night music not available');
  }
}

function checkJumpscares() {
  // Check if any animatronic is at the door
  for (const [name, anim] of Object.entries(animatronics)) {
    if (anim.atDoorNow) {
      // Check if doors are closed
      const doorClosed = (name === 'tilly' || name === 'balloona') ? 
        game.leftDoorClosed : game.rightDoorClosed;
      
      if (!doorClosed) {
        // Trigger jumpscare
        game.state = "jumpscare";
        game.jumpscare = name;
        if (sndJumpscare) sndJumpscream.play();
        return;
      }
    }
  }
}

function runGameLoop() {
  // Handle power drain
  handlePowerDrain();
  
  // Update animatronics only if not in grace period (only on night 1)
  const inGracePeriod = game.currentNight === 1 && (millis() - game.nightStartTime < GRACE_PERIOD_MS);
  if (!inGracePeriod) {
    updateAnimatronics();
  }
  
  // Check for jumpscares
  checkJumpscares();
  
  // Check for win condition (6 AM)
  if (millis() - game.nightStartTime >= NIGHT_LENGTH_MS) {
    // Player survived the night
    if (game.currentNight >= WIN_GAME_NIGHT) {
      // Game completed – ensure phone call is stopped
      gameState = STATE_WIN_GAME;
      winGameTimer = millis();
    } else {
      gameState = STATE_WIN_NIGHT;
      winNightStartTime = millis();
    }
  }
  
  const elapsed = millis() - game.nightStartTime;
  const rem = max(0, NIGHT_LENGTH_MS - elapsed);
  const mins = floor(rem / 60000), secs = floor((rem % 60000) / 1000);
  if (rem <= 0) {
    if (game.currentNight < 5) {
      // proceed to next night automatically
      startNight(game.currentNight + 1);
      return;
    } else {
      endGame("You survived all 5 nights!");
      return;
    }
  }
  game.showCams ? renderCameras() : renderOffice();
  drawHUD(mins, secs);
}

function handleGameplayClick() {
  if (game.state !== "playing") return;
  cams.forEach(c => { if (hitTest(c)) game.selectedCam = c.id; });

  if (isScreechReady() && hitTest(buttons.screech) && game.selectedCam >= 0) {
    game.lastScreechTime = millis();
    game.screechCount++;
    animatronics.tilly.lureTo(game.selectedCam);
    // play screech sound
    if (sndScreech) {
      sndScreech.play();
      // auto-stop after 1 second to avoid lingering
      setTimeout(() => { if (sndScreech.isPlaying()) sndScreech.stop(); }, 2000);
    }
    // drain power for screech
    game.power = max(0, game.power - SCREECH_POWER_DRAIN);
    animatronics.crowman.blockedCams = animatronics.crowman.blockedCams.filter(c => c !== game.selectedCam);
  }

  if (!game.showCams && hitTest(buttons.deflate)) {
    animatronics.balloona.deflate();
  }
}

function handlePowerDrain() {
  if (game.state !== "playing") return; // don't drain when not playing
  const now = millis();
  if (now - game.lastPowerDrainTime < 1000) return;
  if (!game.showCams && !game.leftDoorClosed && !game.rightDoorClosed) {
    game.lastPowerDrainTime = now;
    return;
  }
  let d = POWER_DRAIN_BASE;
  if (game.showCams) d += POWER_DRAIN_CAM;
  if (game.leftDoorClosed) d += DOOR_DRAIN;
  if (game.rightDoorClosed) d += DOOR_DRAIN;
  game.power = max(0, game.power - d);
  game.lastPowerDrainTime = now;
  if (game.power <= 0) startPowerOut();
}

function startPowerOut() {
  if (game.state !== "playing") return;
  // Stop all sounds when power goes out
  if (sndCameraStatic && cameraStaticPlaying) {
    sndCameraStatic.stop();
    cameraStaticPlaying = false;
  }
  if (sndFan && fanPlaying) {
    sndFan.stop();
    fanPlaying = false;
  }
  
  game.state = "powerout";
  game.poweroutStart = millis();
  game.crowmanWait = random(6000, 12000); // random wait 6-12 s
  game.showCams = false;
  game.leftDoorClosed = false;
  game.rightDoorClosed = false;
  // Reset Balloona inflation so she disappears
  if (animatronics.balloona) {
    animatronics.balloona.size = 0;
    animatronics.balloona.lastInflate = millis();
  }
}

function updateAnimatronics() {
  const now = millis();
  Object.values(animatronics).forEach(a => a.update(now));
}

function drawHUD(mins, secs) {
  fill(255);
  textSize(16);
  textAlign(LEFT, TOP);
  text(`Time: ${nf(mins, 2)}:${nf(secs, 2)}`, 10, 10);
  text(`Power: ${game.power.toFixed(1)}%`, 10, 30);
  text(`Night: ${game.currentNight}`, 10, 50);
}

// ────────────────────────────────────────────────────
// VIEWS

function renderOffice() {
  imgOffice ? image(imgOffice, 0, 0, width, height) : rect(0, 0, width, height);

  const elapsed = millis() - game.nightStartTime;
  const SHOW_TIME = 10000;      // fully visible for 10s
  const BLINK_DURATION = 2000;  // then blink for 2s

  let showControls = false;
  if (elapsed < SHOW_TIME) {
    showControls = true;
  } else if (elapsed < SHOW_TIME + BLINK_DURATION) {
    const interval = 250;
    showControls = Math.floor((elapsed - SHOW_TIME) / interval) % 2 === 0;
  }

  if (showControls) {
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(24);
    text("Office - 'C' toggles cams, 'A'/'D' doors", width / 2, 40);
  }

  // Draw Balloona (hidden during power-out)
  if (game.state !== "powerout" && imgBalloona && imgBalloonaHead) {
    const balloona = animatronics.balloona;
    
    // Always draw the body at full size
    image(imgBalloona, 
      width / 2 - BALLOONA_BODY_SIZE/2, 
      height / 2 + 50 - BALLOONA_BODY_SIZE/2, 
      BALLOONA_BODY_SIZE, 
      BALLOONA_BODY_SIZE
    );
    
    // Draw head with changing size
    if (balloona.headSize > 0) {
      const headSize = map(balloona.headSize, 0, 100, BALLOONA_HEAD_MIN_SIZE, BALLOONA_HEAD_MAX_SIZE);
      // Calculate positions
      const bodyTop = height / 2 + 50 - BALLOONA_BODY_SIZE/2;
      const headY = bodyTop - headSize * 0.009; // Slight overlap with body
      
      // Draw head centered above body
      image(imgBalloonaHead, 
        width / 2 - headSize/2,  // Center horizontally
        headY,                   // Position above body
        headSize, 
        headSize
      );
      
      // Optional: Draw a debug line to show the anchor point
      // stroke(255, 0, 0);
      // line(width/2, bodyTop, width/2, bodyTop - headSize);
    }
  }
  drawButton(buttons.deflate, "DEFLATE");
  drawDoorImages();
}

function renderCameras() {
  const sel = game.selectedCam;
  if (animatronics.crowman.blockedCams.includes(sel)) {
    fill(30, 0, 0); // Dark red background
    rect(0, 0, width, height);
    
    if (imgCrowBlocked) {
      // Calculate size to maintain aspect ratio
      const imgAspect = imgCrowBlocked.width / imgCrowBlocked.height;
      let imgWidth = width * 0.8; // 80% of screen width
      let imgHeight = imgWidth / imgAspect;
      
      // If too tall, scale down
      if (imgHeight > height * 0.8) {
        imgHeight = height * 0.8;
        imgWidth = imgHeight * imgAspect;
      }
      
      // Center the image
      image(imgCrowBlocked, 
        (width - imgWidth) / 2, 
        (height - imgHeight) / 2,
        imgWidth, 
        imgHeight
      );
    } else {
      // Fallback to text if image fails to load
      fill(255, 0, 0);
      textAlign(CENTER, CENTER);
      textSize(32);
      text("CAMERA BLOCKED", width / 2, height / 2);
    }
  } else {
    drawCamView(sel);
  }

  cams.forEach(c => drawButton(c, c.label, sel === c.id));
  drawButton(buttons.screech, "!", isScreechReady());

  const attackCams = cams.filter(c => c.id === 2 || c.id === 4);
  if (attackCams.length === 2) {
    const [a, b] = attackCams;
    const youX = (a.x + b.x) / 2 + a.w / 2;
    const youY = (a.y + b.y) / 2 + a.h / 2;
    fill(0, 150, 255, 180);
    ellipse(youX, youY, 20);
    fill(255);
    textSize(10);
    textAlign(CENTER, CENTER);
    text("YOU", youX, youY);
  }
}

function drawCamView(idx) {
  if (idx < 0) return;
  
  // Camera 3 (left door)
  if (idx === 2) {
    const img = game.leftDoorClosed ? imgCam3DoorClosed : imgCam3;
    if (img) image(img, 0, 0, width, height);
    else { fill(0); rect(0, 0, width, height); }
  }
  // Camera 5 (right door)
  else if (idx === 4) {
    const img = game.rightDoorClosed ? imgCam5DoorClosed : imgCam5;
    if (img) image(img, 0, 0, width, height);
    else { fill(0); rect(0, 0, width, height); }
  }
  // Other cameras
  else if (camImages[idx]) {
    image(camImages[idx], 0, 0, width, height);
  } else { 
    fill(0); 
    rect(0, 0, width, height); 
  }

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(32);
  text(`Viewing ${cams[idx].label}`, width / 2, 40);

  // Draw Tilly
  if (animatronics.tilly.pos === idx) {
    if (imgTilly) {
      image(imgTilly, 
        width / 2 - TILLY_SIZE - 10, 
        height / 2 - TILLY_SIZE/2, 
        TILLY_SIZE, 
        TILLY_SIZE
      );
    } else {
      fill(255, 0, 0);
      ellipse(width / 2 + 40, height / 2, 40, 40);
    }
  }

  // Draw Dizzy
  if (animatronics.dizzy.currentCam === idx + 1) {
    if (animatronics.dizzy.img) {
      image(animatronics.dizzy.img, 
        width / 2 + 10, 
        height / 2 - DIZZY_SIZE/2, 
        DIZZY_SIZE, 
        DIZZY_SIZE
      );
    } else {
      fill(0, 255, 0);
      ellipse(width / 2 + 40, height / 2, 40, 40);
    }
  }
}

function drawDoorImages() {
  if (game.leftDoorClosed && imgLeftDoor) image(imgLeftDoor, 1, -20);
  if (game.rightDoorBroken && imgRightDoorBroken) {
    image(imgRightDoorBroken, 1, -20);
  } else if (game.rightDoorClosed && imgRightDoor) {
    image(imgRightDoor, 1, -20);
  }
}

function drawButton(b, label, active = true) {
  stroke(0);
  strokeWeight(2);
  fill(active ? [80, 80, 120] : 50);
  rect(b.x, b.y, b.w, b.h, 8);
  noStroke();
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(14);
  text(label, b.x + b.w / 2, b.y + b.h / 2);
}

function hitTest(b) {
  return mouseX > b.x && mouseX < b.x + b.w && mouseY > b.y && mouseY < b.y + b.h;
}

function isScreechReady() {
  return millis() - game.lastScreechTime >= SCREECH_COOLDOWN_MS;
}

function triggerJumpscare(img, msg, duration = 2000) {
  // Stop all sounds
  if (sndPowerout && sndPowerout.isPlaying()) sndPowerout.stop();
  if (sndCameraStatic && cameraStaticPlaying) {
    sndCameraStatic.stop();
    cameraStaticPlaying = false;
  }
  if (sndFan && fanPlaying) {
    sndFan.stop();
    fanPlaying = false;
  }
  
  if (sndJumpscare) {
    sndJumpscare.play();
    setTimeout(() => { if (sndJumpscare.isPlaying()) sndJumpscare.stop(); }, duration);
  }
  game.state = "jumpscare";
  game.jumpscareImg = img;
  setTimeout(() => endGame(msg), duration);
}

function endGame(msg) {
  // Stop all sounds
  if (sndPowerout && sndPowerout.isPlaying()) sndPowerout.stop();
  if (sndScreech && sndScreech.isPlaying()) sndScreech.stop();
  if (sndJumpscare && sndJumpscare.isPlaying()) sndJumpscare.stop();
  if (sndCameraStatic && cameraStaticPlaying) {
    sndCameraStatic.stop();
    cameraStaticPlaying = false;
  }
  if (sndFan && fanPlaying) {
    sndFan.stop();
    fanPlaying = false;
  }
  
  // Stop any ongoing phone call
  stopPhoneCall();
  
  game.state = "gameover";
  game.gameoverMsg = msg;
}

function showGameOver() {
  // Display game over image if available, otherwise use black background
  if (imgDeathScreen) {
    // Center and scale the image to fit the canvas while maintaining aspect ratio
    let scale = min(width / imgDeathScreen.width, height / imgDeathScreen.height);
    let imgWidth = imgDeathScreen.width * scale;
    let imgHeight = imgDeathScreen.height * scale;
    let x = (width - imgWidth) / 2;
    let y = (height - imgHeight) / 2;
    image(imgDeathScreen, x, y, imgWidth, imgHeight);
  } else {
    background(0);
  }
  
  // Draw buttons
  const buttonY = height * 0.8;  // Position buttons near bottom of screen
  const buttonWidth = 180;
  const buttonHeight = 50;
  const buttonSpacing = 20;
  
  // Play Again button
  const playAgainBtn = { 
    x: width / 2 - buttonWidth - buttonSpacing/2, 
    y: buttonY, 
    w: buttonWidth, 
    h: buttonHeight 
  };
  
  // Main Menu button
  const menuBtn = { 
    x: width / 2 + buttonSpacing/2, 
    y: buttonY, 
    w: buttonWidth, 
    h: buttonHeight 
  };
  
  // Store button references for click detection
  game.buttons = {
    playAgain: playAgainBtn,
    menu: menuBtn
  };
  
  // Draw semi-transparent background for buttons for better visibility
  fill(0, 0, 0, 150);
  rect(0, buttonY - 10, width, buttonHeight + 20);
  
  // Draw buttons
  drawButton(playAgainBtn, "PLAY AGAIN");
  drawButton(menuBtn, "MAIN MENU");
}

// ────────────────────────────────────────────────────
// ANIMATRONIC CLASSES

class Tilly {
  constructor(level) {
    this.level = level;
    this.path = [0, 3, 4];
    this.pos = 0;
    this.moveChance = (level / 20) * 0.7; // Reduced base move chance
    this.lastMove = millis();
    this.atDoorNow = false;
    this.img = loadImage("tilly.png");
    this.nextMoveDelay = 0; // Will be set before first move
    this.updateNextMoveDelay();
  }
  
  updateNextMoveDelay() {
    // Random delay between 10-30 seconds, modified by level
    const baseDelay = random(10000, 30000);
    const levelFactor = map(this.level, 1, 20, 1.5, 0.7); // Higher levels = shorter delays
    this.nextMoveDelay = baseDelay * levelFactor;
  }

  update(now) {
    // Only check for movement if enough time has passed
    if (now - this.lastMove < this.nextMoveDelay) return;

    // Add some randomness to movement chance based on level
    const effectiveMoveChance = this.moveChance * (0.8 + random(0.4)); // Randomness between 80-120% of base chance
    
    if (random() < effectiveMoveChance) {
      const currentIndex = this.path.indexOf(this.pos);
      if (currentIndex < this.path.length - 1) {
        this.pos = this.path[currentIndex + 1];
        this.lastMove = now;
        this.updateNextMoveDelay(); // Get a new random delay for next move
      } else {
        if (game.rightDoorClosed) {
          game.rightDoorBroken = true;
          game.rightDoorClosed = false;
          setTimeout(() => triggerJumpscare(imgTillyScare, "Tilly broke through the door and got you!", 2500), 800);
        } else {
          triggerJumpscare(imgTillyScare, "Tilly got you!", 2000);
        }
      }
    }
  }

  lureTo(cam) {
    const adjacent = { 0: [3], 3: [0, 4], 4: [3] };
    if (adjacent[this.pos]?.includes(cam)) {
      this.pos = cam;
    }
  }
}

class Balloona {
  constructor(level) {
    this.level = level;
    this.baseInflateTime = random(10000, 20000); // Random base time between inflations
    this.inflateInterval = mapLevel(level, 0, 20, this.baseInflateTime * 1.5, this.baseInflateTime * 0.7);
    this.lastInflate = millis();
    this.headSize = 0;  // Head size (0-100%)
  }


  update(now) {
    if (now - this.lastInflate >= this.inflateInterval) {
      const wasAboutToPop = this.headSize >= 90; // Check if we're about to pop
      
      // Only grow the head
      this.headSize = min(100, this.headSize + 10);
      this.lastInflate = now;
      
      // Randomize next inflate time slightly
      this.inflateInterval = mapLevel(
        this.level, 
        0, 20, 
        this.baseInflateTime * (0.8 + random(0.4)), // Randomize between 80-120%
        this.baseInflateTime * (0.6 + random(0.3))  // Of base time
      );
      
      // Check if we just reached max capacity
      if (this.headSize >= 100) {
        this.headSize = 100;
        // Play pop sound only if we just reached max capacity
        if (sndPop && wasAboutToPop) {
          sndPop.play();
        }
      }
    }
  }

  deflate() {
    this.headSize = 0;
    this.lastInflate = millis();
    // No sound on manual deflate
  }
}

class Crowman {
  constructor(level) {
    this.level = level;
    this.blockInterval = mapLevel(level, 0, 20, 180000, 45000);
    this.blockDuration = mapLevel(level, 0, 20, 30000, 60000);
    this.dualBlockChance = (level / 20) * 0.5;
    this.blockedCams = [];
    this.lastBlock = 0;
    this.lastDual = -Infinity;
    this.dualCooldown = 180000;
  }

  update(now) {
    if (this.blockedCams.length && now - this.lastBlock > this.blockDuration) {
      this.blockedCams = [];
    }

    if (!this.blockedCams.length && now - this.lastBlock > this.blockInterval) {
      if (now - this.lastDual > this.dualCooldown && random() < this.dualBlockChance) {
        let a = floor(random(cams.length)), b;
        do { b = floor(random(cams.length)); } while (b === a);
        this.blockedCams = [a, b];
        this.lastDual = now;
      } else {
        this.blockedCams = [floor(random(cams.length))];
      }
      this.lastBlock = now;
    }
  }
}

class Dizzy {
  constructor(level) {
    this.level = level;
    this.baseMoveDelay = 20000;
    this.lastMoveTime = millis();
    this.currentCam = 1;
    this.lastCam = null;
    this.killedYou = false;
    this.attacking = false;
    this.attackStartTime = 0;
    this.prepTime = 5000;
    this.attackDuration = 2000;
    this.img = imgDizzy;
    this.nextMoveDelay = this.calculateNextMoveDelay();
  }
  
  calculateNextMoveDelay() {
    // Base delay with some randomness and level scaling
    const randomFactor = 0.7 + random(0.6); // 0.7 to 1.3
    const levelFactor = map(this.level, 1, 20, 1.4, 0.7); // Higher levels = shorter delays
    return this.baseMoveDelay * randomFactor * levelFactor;
  }

  update(now) {
    if (this.killedYou) return;

    if ((this.currentCam === 3 || this.currentCam === 5) && this.lastMoveTime === 0) {
      this.currentCam = 1;
      this.lastMoveTime = now;
      return;
    }

    if (this.attacking) {
      const elapsed = now - this.attackStartTime;

      if (elapsed < this.prepTime) {
        return;
      }

      const doorOpen = (this.currentCam === 3 && !game.leftDoorClosed) ||
                     (this.currentCam === 5 && !game.rightDoorClosed);

      if (doorOpen) {
        this.killedYou = true;
        triggerJumpscare(imgDizzyScare, "Dizzy got you!", 2000);
        return;
      }

      if (elapsed >= this.prepTime + this.attackDuration) {
        this.attacking = false;
        this.attackStartTime = 0;
        this.currentCam = 1;
        this.lastCam = null;
        this.lastMoveTime = now;
      }
      return;
    }

    if (now - this.lastMoveTime < this.nextMoveDelay) return;

    let options = getDizzyAdjacentCams(this.currentCam);
    
    if (this.currentCam === 3 || this.currentCam === 5) {
      // keep options as-is
    } else {
      options = options.filter(c => c !== this.lastCam);
    }

    if (!options.length) return;

    this.lastCam = this.currentCam;
    this.currentCam = random(options);
    this.lastMoveTime = now;
    this.nextMoveDelay = this.calculateNextMoveDelay();

    if ((this.currentCam === 3 || this.currentCam === 5) && !this.attacking) {
      this.attacking = true;
      this.attackStartTime = now;
    }
  }
}

function getDizzyAdjacentCams(camId) {
  const graph = {
    1: [2, 4],
    2: [1, 3],
    3: [2],
    4: [1, 5],
    5: [4],
  };
  return graph[camId] || [];
}

function mapLevel(l, lo1, hi1, lo2, hi2) {
  // If level is 0, return the maximum delay (effectively disabling movement)
  if (l === 0) return Infinity;
  return lo2 + (hi2 - lo2) * ((l - lo1) / (hi1 - lo1));
}