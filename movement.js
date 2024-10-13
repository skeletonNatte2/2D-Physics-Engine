//Global variables
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

ctx.lineWidth = 3.75;

var airRes = 0.0000025;
var gravity = 21*2.75;
var staticFrict = 0.6;
var dynFrict = 0.3;

var dt = (0.5/60);

var UP;
var DOWN;
var LEFT;
var RIGHT;
var A;
var D;

var JOINED = [];
var OBJECTS = [];
var COLLISIONS = [];

//Misc Classes
class Vector{
    constructor(x, y){
        this.x = x;
        this.y = y;
    }

    gets(newX, newY){
        this.x = newX;
        this.y = newY;
    }

    add(vec){
        return new Vector(this.x + vec.x, this.y + vec.y);
    }

    subtr(vec){
        return new Vector(this.x - vec.x, this.y - vec.y);
    }

    mult(n){
        return new Vector(this.x * n, this.y * n);
    }

    dotProd(vec){
        return (this.x * vec.x) + (this.y * vec.y);
    }

    crossProd(vec){
        return (this.x*vec.y) - (this.y*vec.x);
    }

    mag(){
        return Math.sqrt(this.x**2 + this.y**2);
    }

    dist(vec){
        return this.subtr(vec).mag();
    }

    unit(){
        if(this.mag() == 0){
            return new Vector(0,0);
        } else {
            return new Vector(this.x / this.mag(), this.y / this.mag());
        }
    }

    normal(){
        return new Vector(-this.y, this.x);
    }

    floorVec(precision){
        return new Vector(floor(this.x,precision), floor(this.y,precision));
    }

    isEqual(vec){
        if(round(this.x,7) == round(vec.x,7) && round(this.y,7) == round(vec.y,7)){
            return true;
        } else {
            return false;
        }
    }

    draw(startX, startY, scale, color = 'rgb(69,221,245)'){
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX + this.x * scale, startY + this.y * scale);
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.closePath();
    }
}

class Matrix{
    constructor(rows, cols){
        this.rows = rows;
        this.cols = cols;
        this.data = [];

        for (let i = 0; i < this.rows; i++){
            this.data[i] = [];
            for (let j = 0; j< this.cols; j++){
                this.data[i][j] = 0;
            }
        }
    }

    multVec(vec){
        let product = new Vector(0,0);
        product.x = this.data[0][0]*vec.x + this.data[0][1]*vec.y;
        product.y = this.data[1][0]*vec.x + this.data[1][1]*vec.y;
        return product;
    }
}

class LineSeg{
    constructor(start, end){
        this.start = start;
        this.end = end;
    }
}

//Object classes
class Ball{
    constructor(pos, r, isStatic = false, elasticity = 0.25, m = 1){
        this.r = r;
        this.pos = pos;
        this.vel = new Vector(0,0);
        this.acc = new Vector(0,0);

        this.angle = 0;
        this.angVel = 0;
        this.angAcc = 0;
        this.dir = new Vector(1,0);
        this.refDir = this.dir;

        this.static = isStatic;
        this.elast = elasticity;
        this.mass = (Math.PI * this.r**2);
        if(this.mass == 0 || this.static){
            this.invM = 0;
        } else {
            this.invM = 1/this.mass;
        }
        this.inertia = (this.mass * this.r**2) / 2;
        if(this.inertia == 0 || this.static){
            this.invI = 0;
        } else {
            this.invI = 1/this.inertia;
        }
    }

    update(){
        this.vel = this.vel.add(this.acc.mult(dt));
        this.vel = this.vel.mult(1-airRes);
        this.pos = this.pos.add(this.vel.mult(dt));
        this.angVel += this.angAcc * dt;
        this.angVel *= (1-airRes);
        this.angle += this.angVel * dt;
        let rotMat = rotMatrix(this.angle);
        this.dir = rotMat.multVec(this.refDir);
    }

    move(vec){
        this.pos = this.pos.add(vec);
    }

    draw(){
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.r, 0, 2*Math.PI);
        ctx.fillStyle = 'rgb(213, 236, 255)';
        ctx.fill();
        ctx.strokeStyle = 'rgb(69,221,245)';
        ctx.stroke();
        ctx.closePath();
        this.dir.draw(this.pos.x, this.pos.y, this.r);
    }
}

class Box{
    constructor(pos, height, width, ang = 0, isStatic = false, elasticity = 0.25, m = 1){
        this.height = height;
        this.width = width;
        this.pos = pos;
        this.vertices = [];
        this.vertices[0] = new Vector(pos.x - width/2, pos.y + height/2);
        this.vertices[1] = new Vector(pos.x + width/2, pos.y + height/2);
        this.vertices[2] = new Vector(pos.x + width/2, pos.y - height/2);
        this.vertices[3] = new Vector(pos.x - width/2, pos.y - height/2);  
        this.vel = new Vector(0,0);
        this.acc = new Vector(0,0);

        this.static = isStatic;
        this.elast = elasticity;
        this.mass = (this.width * this.height);
        if(this.mass == 0 || this.static){
            this.invM = 0;
        } else {
            this.invM = 1/this.mass;
        }
        this.inertia = (this.mass * (this.height**2 + this.width**2)) / 12;
        if(this.inertia == 0 || this.static){
            this.invI = 0;
        } else {
            this.invI = 1/this.inertia;
        }

        this.angle = ang;
        this.angVel = 0;
        this.angAcc = 0;
        this.dir = this.vertices[1].subtr(this.vertices[0]).unit();
        this.refDir = this.dir;

        if(this.angle % (2*Math.PI) != 0){
            let rotMat = rotMatrix(this.angle);
            this.dir = rotMat.multVec(this.refDir);
            this.vertices[0] = this.pos.add(this.dir.mult(-this.width/2)).add(this.dir.unit().normal().mult(this.height/2));
            this.vertices[1] = this.pos.add(this.dir.mult(this.width/2)).add(this.dir.unit().normal().mult(this.height/2));
            this.vertices[2] = this.pos.add(this.dir.mult(this.width/2)).add(this.dir.unit().normal().mult(-this.height/2));
            this.vertices[3] = this.pos.add(this.dir.mult(-this.width/2)).add(this.dir.unit().normal().mult(-this.height/2));
        }
    }

    update(){
        this.vel = this.vel.add(this.acc.mult(dt));
        this.vel = this.vel.mult(1-airRes);
        this.pos = this.pos.add(this.vel.mult(dt));
        this.angVel += this.angAcc * dt;
        this.angVel *= (1-airRes);
        this.angle += this.angVel * dt;
        let rotMat = rotMatrix(this.angle);
        this.dir = rotMat.multVec(this.refDir);
        this.vertices[0] = this.pos.add(this.dir.mult(-this.width/2)).add(this.dir.unit().normal().mult(this.height/2));
        this.vertices[1] = this.pos.add(this.dir.mult(this.width/2)).add(this.dir.unit().normal().mult(this.height/2));
        this.vertices[2] = this.pos.add(this.dir.mult(this.width/2)).add(this.dir.unit().normal().mult(-this.height/2));
        this.vertices[3] = this.pos.add(this.dir.mult(-this.width/2)).add(this.dir.unit().normal().mult(-this.height/2));
    }

    move(vec){
        this.pos = this.pos.add(vec);
        for(let i = 0; i < 4; i++){
            this.vertices[i] = this.vertices[i].add(vec);
        }
    }

    draw(){
        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        ctx.lineTo(this.vertices[1].x, this.vertices[1].y);
        ctx.lineTo(this.vertices[2].x, this.vertices[2].y);
        ctx.lineTo(this.vertices[3].x, this.vertices[3].y);
        ctx.lineTo(this.vertices[0].x, this.vertices[0].y);
        ctx.fillStyle = 'rgb(213, 236, 255)';
        ctx.fill();
        ctx.strokeStyle = 'rgb(69,221,245)';
        ctx.stroke();
        ctx.closePath();
    }
}

class Wall{
    constructor(start, end, isStatic = true, m = 1){
        this.width = start.subtr(end).mag();
        this.vertices = [];
        this.vertices[0] = start;
        this.vertices[1] = end;

        this.pos = this.vertices[0].add(this.vertices[1]).mult(0.5);
        this.vel = new Vector(0,0);
        this.acc = new Vector(0,0);

        this.static = isStatic;
        this.elast = 1;
        this.mass = m;
        if(this.mass == 0 || this.static){
            this.invM = 0;
        } else {
            this.invM = 1/this.mass;
        }
        this.inertia = (this.mass * this.width**2) / 12;
        if(this.inertia == 0 || this.static){
            this.invI = 0;
        } else {
            this.invI = 1/this.inertia;
        }

        this.angle = 0;
        this.angVel = 0;
        this.angAcc = 0;
        this.dir = this.vertices[1].subtr(this.vertices[0]).unit();
        this.refDir = this.dir;
    }

    update(){
        this.vel = this.vel.add(this.acc.mult(dt));
        this.vel = this.vel.mult(1-airRes);
        this.pos = this.pos.add(this.vel.mult(dt));
        this.angVel += this.angAcc * dt;
        this.angVel *= (1-airRes);
        this.angle += this.angVel * dt;
        let rotMat = rotMatrix(this.angle);
        this.dir = rotMat.multVec(this.refDir);
        this.vertices[0] = this.pos.add(this.dir.mult(-this.width/2));
        this.vertices[1] = this.pos.add(this.dir.mult(this.width/2));
    }

    move(vec){
        this.pos = this.pos.add(vec);
        for(let i = 0; i < 2; i++){
            this.vertices[i] = this.vertices[i].add(vec);
        }
    }

    draw(){
        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        ctx.lineTo(this.vertices[1].x, this.vertices[1].y);
        ctx.strokeStyle = 'rgb(69,221,245)';
        ctx.stroke();
        ctx.closePath();
    }
}

//Creates objects
function createBall(x, y, r, isStatic, elasticity, m, velocity = new Vector(0,0), location = [OBJECTS]){
   ball = new Ball(new Vector(x,y),r,isStatic,elasticity,m);
   ball.vel = velocity;
   let l = location.length;
   for(let i = 0; i < l; i++){
        location[i].push(ball);
    }
    return ball;
}

function createBox(x, y, height, width, ang, isStatic, elasticity, m, velocity = new Vector(0,0), location = [OBJECTS]){
    box = new Box(new Vector(x,y),height,width,ang,isStatic,elasticity,m);
    box.vel = velocity;
    let l = location.length;
    for(let i = 0; i < l; i++){
        location[i].push(box);
    }
    return box;
}

function createWall(startX, startY, endX, endY, isStatic, m, location = [OBJECTS]){
    wall = new Wall(new Vector(startX,startY),new Vector(endX,endY),isStatic,m);
    let l = location.length;
    for(let i = 0; i < l; i++){
        location[i].push(wall);
    }
}

function createMassPoint(x, y, isStatic, elasticity, m, velocity, location){
    let point = createBall(x,y,0.001,isStatic,elasticity,m,velocity,location);
    point.invI = 0;
    return point;
}

function createSoft(x, y, dimX, dimY, spacing){
    let soft = new Matrix(dimY,dimX);
    for(let i = 0; i < soft.cols; i++){
        for(let j = 0; j < soft.rows; j++){
            soft.data[j][i] = createMassPoint(x+(i*spacing),y+(j*spacing));
        }
    }
    for(let i = 0; i < soft.cols-1; i++){
        for(let j = 0; j < soft.rows; j++){
            attatch(soft.data[j][i],soft.data[j][i+1],spacing);
        }
    }
    for(let i = 0; i < soft.cols; i++){
        for(let j = 0; j < soft.rows-1; j++){
            attatch(soft.data[j][i],soft.data[j+1][i],spacing);
        }
    }
    for(let i = 0; i < soft.cols-1; i++){
        for(let j = 0; j < soft.rows-1; j++){
            attatch(soft.data[j][i],soft.data[j+1][i+1],Math.sqrt((spacing**2) * 2));
        }
    }
    for(let i = 1; i < soft.cols; i++){
        for(let j = 0; j < soft.rows-1; j++){
            attatch(soft.data[j][i],soft.data[j+1][i-1],Math.sqrt((spacing**2) * 2));
        }
    }
}

//Creates rotation matrix for a given angle
function rotMatrix(angle){
    let mx = new Matrix(2,2);
    mx.data[0][0] = Math.cos(angle);
    mx.data[0][1] = -Math.sin(angle);
    mx.data[1][0] = Math.sin(angle);
    mx.data[1][1] = Math.cos(angle);
    return mx;
}

//Attatches two objects with spring
function attatch(obj1, obj2, restingLength){
    JOINED.push([obj1,obj2,restingLength]);
}

//Applies spring force to attatched objects
function applySpringForce(pair){
    let forceDir = pair[0].pos.subtr(pair[1].pos);
    let restingLength = pair[2];
    let stiffness = 350;
    let damping = 2.75;

    let forceMag = (forceDir.mag()-restingLength) * stiffness;
    forceMag += forceDir.unit().dotProd(pair[0].vel.subtr(pair[1].vel)) * damping;
    let force = forceDir.unit().mult(forceMag);

    pair[0].acc = pair[0].acc.add(force.mult(-1));
    pair[1].acc = pair[1].acc.add(force.mult(1));
}

//Number functions
function random(min, max){
    return Math.random() * (max-min+1) + min;
}

function round(number, precision){
    let factor = 10**precision;
    return Math.round(number * factor) / factor;
}

function floor(number, precision){
    let factor = 10**precision;
    return Math.floor(number * factor) / factor;
}

//Test functions 
function drawTest(pos){
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 5, 0, 2*Math.PI);
    ctx.strokeStyle = 'rgb(213, 236, 255)';
    ctx.stroke();
    ctx.closePath();
}

function testText(text, y){
    ctx.fillStyle = 'rgb(213, 236, 255)';
    ctx.fillText(text, 15, y);
}

//Takes user input
function userInput(entity = null){
    addEventListener('keydown', e => {
        if(e.key == 'ArrowUp'){
            UP = true;
        }
        if(e.key == 'ArrowDown'){
            DOWN = true;
        }
        if(e.key == 'ArrowLeft'){
            LEFT = true;
        }
        if(e.key == 'ArrowRight'){
            RIGHT = true;
        }
        if(e.key == 'a'){
            A = true;
        }
        if(e.key == 'd'){
            D = true;
        }
        if(e.key == '1'){
            loadPreset1();
        }
        if(e.key == '2'){
            loadPreset2();
        }
        if(e.key == '3'){
            loadPreset3();
        }
        if(e.key == '4'){
            loadPreset4();
        }
    });

    if(entity != null){
        addEventListener('keyup', e => {
            if(e.key == 'ArrowUp'){
                UP = false;
            }
            if(e.key == 'ArrowDown'){
                DOWN = false;
            }
            if(e.key == 'ArrowLeft'){
                LEFT = false;
            }
            if(e.key == 'ArrowRight'){
                RIGHT = false;
            }
            if(e.key == 'a'){
                A = false;
            }
            if(e.key == 'd'){
                D = false;
            }
        });

        if(UP){
            entity.vel.y = -20;
        }
        if(DOWN){
            entity.vel.y = 20;
        }
        if(LEFT){
            entity.vel.x = -20;
        }
        if(RIGHT){
            entity.vel.x = 20;
        }
        if (!UP && !DOWN){
            entity.vel.y = 0;
        }
        if(!LEFT && !RIGHT){
        entity.vel.x = 0;
        }
        if(A){
            entity.angVel = -0.5;
        }
        if(D){
            entity.angVel = 0.5;
        }
        if(!A && !D){
            entity.angVel = 0;
        }
    }
}

//Returns the min and max of object vertices along given axis
function projectOnToAxis(axis, obj){
    let min;
    let max;
    if(obj instanceof Ball){
        min = axis.unit().dotProd(obj.pos) - obj.r;
        max = axis.unit().dotProd(obj.pos) + obj.r;
    } else {
        let l = obj.vertices.length;
        for(let i = 0; i < l; i++){
            distAlong = axis.unit().dotProd(obj.vertices[i]);
            if(distAlong < min || min == undefined){
                min = distAlong;
            }
            if(distAlong > max || max == undefined){
                max = distAlong;
            }
        }
    }
    return {
        min: min,
        max: max
    };
}

function collidingOverAxis(obj1, obj2, axis){
    let proj1 = projectOnToAxis(axis,obj1);
    let proj2 = projectOnToAxis(axis,obj2);
    if(Math.min(proj1.max, proj2.max) - Math.max(proj1.min, proj2.min) >= 0){
        return true;
    }
    return false;
}

//Returns all relevant axes to be used in collision detection
function getAxes(obj1, obj2){
    let axes = [];

    if(obj1 instanceof Ball && obj2 instanceof Ball){
        axes.push(obj2.pos.subtr(obj1.pos).unit());
        return axes;
    }

    if(!(obj1 instanceof Ball)){
        if(obj1 instanceof Box){
            axes.push(obj1.dir);
            axes.push(obj1.dir.normal());
        } else {
            axes.push(obj1.dir.normal());
        }
    } else {
        let l = obj2.vertices.length;
        for(let i = 0; i < l; i++){
            axes.push(obj1.pos.subtr(obj2.vertices[i]).unit());
        }
    }

    if(!(obj2 instanceof Ball)){
        if(obj2 instanceof Box){
            axes.push(obj2.dir);
            axes.push(obj2.dir.normal());
        } else {
            axes.push(obj2.dir.normal());
        }
    } else {
        let l = obj1.vertices.length;
        for(let i = 0; i < l; i++){
            axes.push(obj2.pos.subtr(obj1.vertices[i]).unit());
        }
    }

    return axes;
}

//Uses the separating axis theorem for precise collision detection
function sat(obj1, obj2){
    let minOverlap = null;
    let smallestAxis;

    let axes = getAxes(obj1, obj2);
    let proj1;
    let proj2;

    if(obj1.static && obj2.static){
        return false;
    }

    let l = axes.length;
    for(let i = 0; i < l; i++){
        proj1 = projectOnToAxis(axes[i], obj1);
        proj2 = projectOnToAxis(axes[i], obj2);
        let overlap = Math.min(proj1.max, proj2.max) - Math.max(proj1.min, proj2.min);
        if(overlap < 0){
            return false;
        }

        if((proj1.max > proj2.max && proj1.min < proj2.min) ||
        (proj1.max < proj2.max && proj1.min > proj2.min)){
            let mins = Math.abs(proj1.min - proj2.min);
            let maxs = Math.abs(proj1.max - proj2.max);
            if (mins < maxs){
                overlap += mins;
            } else {
                overlap += maxs;
            }
        }

        if(overlap < minOverlap || minOverlap == null){
            minOverlap = overlap;
            smallestAxis = axes[i].mult(Math.sign(obj1.pos.dotProd(axes[i]) - obj2.pos.dotProd(axes[i])));
        }
    }

    return {
        penDepth: minOverlap,
        axis: smallestAxis
    }
}

//Collision point detection functions
function closestPointOnLS(point, LS){
    let unitLS = LS.end.subtr(LS.start).unit();

    let pointToStart = LS.start.subtr(point);
    if(pointToStart.dotProd(unitLS) > 0){
        return {
            closest: LS.start,
            dist: LS.start.subtr(point).mag()
        };
    }

    let endToPoint = point.subtr(LS.end);
    if(endToPoint.dotProd(unitLS) > 0){
        return {
            closest: LS.end,
            dist: LS.end.subtr(point).mag()
        };
    }

    let closest = LS.start.subtr(unitLS.mult(pointToStart.dotProd(unitLS)));
    return {
        closest: closest,
        dist: closest.subtr(point).mag()
    };
}

function getCollPoints(obj1, obj2){
    let collPoints = [];

    if(obj1 instanceof Ball && obj2 instanceof Ball){
        return obj1.pos.subtr(obj2.pos).unit().mult(obj2.r).add(obj2.pos);
    }

    let side;
    let closestToSide;
    let minDist = null;
    if(obj1 instanceof Ball){
        let l = obj2.vertices.length;
        for(let i = 0; i < l; i++){
            side = new LineSeg(obj2.vertices[i],obj2.vertices[(i+1)%obj2.vertices.length]);
            closestToSide = closestPointOnLS(obj1.pos, side);
            if(closestToSide.dist < minDist || minDist == null){
                minDist = closestToSide.dist;
                collPoints = [closestToSide.closest];
            }
        }
    }
    if(obj2 instanceof Ball){
        let l = obj1.vertices.length;
        for(let i = 0; i < l; i++){
            side = new LineSeg(obj1.vertices[i],obj1.vertices[(i+1)%obj1.vertices.length]);
            closestToSide = closestPointOnLS(obj2.pos, side);
            if(closestToSide.dist < minDist || minDist == null){
                minDist = closestToSide.dist;
                collPoints = [closestToSide.closest];
            }
        }
    }
    if(!(obj1 instanceof Ball) && !(obj2 instanceof Ball)){
        let l = obj1.vertices.length;
        let l1 = obj2.vertices.length;
        for(let i = 0; i < l; i++){
            for(let j = 0; j < l1; j++){
                side = new LineSeg(obj1.vertices[i],obj1.vertices[(i+1)%obj1.vertices.length]);
                closestToSide = closestPointOnLS(obj2.vertices[j], side);
                if(closestToSide.dist == minDist &&
                    collPoints.length < 2 &&
                    !collPoints[0].isEqual(closestToSide.closest)){
                   collPoints.push(closestToSide.closest);
                }
                if(closestToSide.dist < minDist || minDist == null){
                    minDist = closestToSide.dist;
                    collPoints = [];
                    collPoints.push(closestToSide.closest);
                }
            }
        }
        for(let i = 0; i < l; i++){
            for(let j = 0; j < l1; j++){
                side = new LineSeg(obj2.vertices[j],obj2.vertices[(j+1)%obj2.vertices.length]);
                closestToSide = closestPointOnLS(obj1.vertices[i], side);
                if(closestToSide.dist == minDist &&
                    collPoints.length < 2 &&
                    !collPoints[0].isEqual(closestToSide.closest)){
                   collPoints.push(closestToSide.closest);
                }
                if(closestToSide.dist < minDist || minDist == null){
                    minDist = closestToSide.dist;
                    collPoints = [];
                    collPoints.push(closestToSide.closest);
                }
            }
        }
    }

    if(collPoints.length == 2){
        return collPoints[0].add(collPoints[1]).mult(0.5);
    }

    return collPoints[0];
}

//Collision resolution functions
function penRes(obj1, obj2, collData){
    let escVec = collData.norm.mult(collData.penDepth / (obj1.invM+obj2.invM));
    obj1.move(escVec.mult(obj1.invM));
    obj2.move(escVec.mult(-obj2.invM));
}

function collRes(obj1, obj2, collData){
    let norm = collData.norm;
    let e = Math.min(obj1.elast,obj2.elast);

    let r1 = collData.cp.subtr(obj1.pos);
    let r2 = collData.cp.subtr(obj2.pos);

    let rotVel1 = r1.normal().mult(obj1.angVel);
    let rotVel2 = r2.normal().mult(obj2.angVel);

    let closVel1 = obj1.vel.add(rotVel1);
    let closVel2 = obj2.vel.add(rotVel2);

    let relVel = closVel1.subtr(closVel2);

    if(relVel.dotProd(norm) <= 0){
        let impAug1 = (r1.crossProd(norm)**2) * obj1.invI;
        let impAug2 = (r2.crossProd(norm)**2) * obj2.invI;

        let impMag = -(1+e) * relVel.dotProd(norm);
        impMag /= obj1.invM + obj2.invM + impAug1 + impAug2;

        let impVec = norm.mult(impMag);
        
        obj1.vel = obj1.vel.add(impVec.mult(obj1.invM));
        obj1.angVel += obj1.invI * r1.crossProd(impVec);

        obj2.vel = obj2.vel.add(impVec.mult(-obj2.invM));
        obj2.angVel -= obj2.invI * r2.crossProd(impVec);

        rotVel1 = r1.normal().mult(obj1.angVel);
        rotVel2 = r2.normal().mult(obj2.angVel);

        closVel1 = obj1.vel.add(rotVel1);
        closVel2 = obj2.vel.add(rotVel2);

        relVel = closVel1.subtr(closVel2);

        let tanVec = relVel.subtr(norm.mult(relVel.dotProd(norm))).unit();

        impAug1 = (r1.dotProd(tanVec)**2) * obj1.invI;
        impAug2 = (r2.dotProd(tanVec)**2) * obj2.invI;

        let impMagFric = -relVel.dotProd(tanVec);
        impMagFric /= obj1.invM + obj2.invM + impAug1 + impAug2;

        let impVecFric;

        if(Math.abs(impMagFric) <= impMag * staticFrict){
            impVecFric = tanVec.mult(impMagFric);
        } else {
            impVecFric = tanVec.mult(-impMag * dynFrict);
        }

        obj1.vel = obj1.vel.add(impVecFric.mult(obj1.invM));
        obj1.angVel += obj1.invI * r1.crossProd(impVecFric);

        obj2.vel = obj2.vel.add(impVecFric.mult(-obj2.invM));
        obj2.angVel -= obj2.invI * r2.crossProd(impVecFric);
    }
}

//Calculates framerate and changes delta time proportionally to inverse fps
function updateDeltaT(){
    end = Date.now();
    fps = 1000/(end-start);
    start = Date.now();
    dt = (0.5/fps);
}

//Creates some fun presets
function loadPreset1(){
    start = Date.now();
    dt = 1/60;
    JOINED = [];
    OBJECTS = [];
    airRes = 0;
    gravity = 21*2.75;
    staticFrict = 0.6;
    dynFrict = 0.3;
    for(let i = 0; i < 20; i++){
        createBox(
            random(37.5,CANVAS_WIDTH-37.5),
            random(-20,CANVAS_HEIGHT-300),
            random(25*3,60*3),
            random(25*3,60*3),
            random(0,2*Math.PI),
            undefined,
            undefined,
            undefined,
            new Vector(random(-95*3,95*3),random(-95*3,95*3))
        );
        createBall(
            random(37.5,CANVAS_WIDTH-37.5),
            random(-20,CANVAS_HEIGHT-300),
            random(12.5*3,30*3),
            undefined,
            undefined,
            undefined,
            new Vector(random(-95*3,95*3),random(-95*3,95*3))
        );
    }
    createWall(CANVAS_WIDTH,-400*3,CANVAS_WIDTH,CANVAS_HEIGHT);
    createWall(0,CANVAS_HEIGHT,0,-400*3);
    createWall(0,-390*3,CANVAS_WIDTH,-390*3);
    createWall(600,600,1500,750);
    createBox(CANVAS_WIDTH/2,CANVAS_HEIGHT,50,CANVAS_WIDTH,0,true);
}

function loadPreset2(){
    start = Date.now();
    dt = 1/60;
    JOINED = [];
    OBJECTS = [];
    gravity = 0;
    airRes = 0;
    staticFrict = 0;
    dynFrict = 0;
    createWall(CANVAS_WIDTH,0,CANVAS_WIDTH,CANVAS_HEIGHT);
    createWall(0,CANVAS_HEIGHT,0,0);
    createWall(0,0,CANVAS_WIDTH,0);
    createWall(0,CANVAS_HEIGHT,CANVAS_WIDTH,CANVAS_HEIGHT);
    for(let i = 0; i < 10; i++){
        createBox(
            random(37.5,CANVAS_WIDTH-37.5),
            random(37.5,CANVAS_HEIGHT-37.5),
            random(30*3,75*3),
            random(30*3,75*3),
            undefined,
            undefined,
            1,
            undefined,
            new Vector(random(-55*3,55*3),random(-55*3,55*3))
        );
        createBall(
            random(37.5,CANVAS_WIDTH-37.5),
            random(37.5,CANVAS_HEIGHT-37.5),
            random(15*3,37.5*3),
            undefined,
            1,
            undefined,
            new Vector(random(-55*3,55*3),random(-55*3,55*3))
        );
    }
}

function loadPreset3(){
    start = Date.now();
    dt = 1/60;
    JOINED = [];
    OBJECTS = [];
    airRes = 0.0000025;
    gravity = 21*2.75;
    staticFrict = 0.6;
    dynFrict = 0.3;
    createSoft(500*3,-250*3,floor(random(3,9),0),floor(random(4,18),0),30*3);
    let softVel = new Vector(random(-45,45),0);
    OBJECTS.forEach(obj => {
        obj.vel = softVel;
    });
    createBox(CANVAS_WIDTH/2, CANVAS_HEIGHT+25, 100, CANVAS_WIDTH, 0, true);
    createBox(CANVAS_WIDTH+10, CANVAS_HEIGHT/2, CANVAS_HEIGHT, 50, 0, true);
    createBox(-10, CANVAS_HEIGHT/2, CANVAS_HEIGHT, 50, 0, true);
    for(let i = 0; i < 5; i++){
        createBall(random(17.5,CANVAS_WIDTH-17.5),CANVAS_HEIGHT+20,random(35,100)*3,true);
    }
}

function loadPreset4(){
    start = Date.now();
    dt = 1/60;
    JOINED = [];
    OBJECTS = [];
    airRes = 0;
    gravity = 21*2.75;
    staticFrict = 0.6;
    dynFrict = 0.3;
    let mp = createMassPoint(
        CANVAS_WIDTH/2,
        CANVAS_HEIGHT/2-75*3,
        true,
        undefined,
        undefined,
        undefined,
        []
    );
    let pos1 = new Vector(random(-1,1),random(-1,1)).unit().mult(150*3).add(mp.pos);
    let pos2 = new Vector(random(-1,1),random(-1,1)).unit().mult(150*3).add(pos1);
    createBall(pos1.x,pos1.y,2);
    createBall(pos2.x,pos2.y,2);
    attatch(mp,OBJECTS[0],150*3);
    attatch(OBJECTS[0],OBJECTS[1],150*3);
}

//=============================================================================
//=============================================================================

function physics(){
    COLLISIONS = [];
    JOINED.forEach(pair => {
        applySpringForce(pair);
    });
    OBJECTS.forEach(obj => {
        if(!obj.static){
            obj.acc.y += gravity;
            obj.update();
            obj.acc.gets(0,0);
        }
    });
    let active = [];
    let axis = new Vector(1,0);
    let l = OBJECTS.length
    for(let i = 0; i < l; i++){
    	key = OBJECTS[i];
        j = i - 1;
        while(j >= 0 && projectOnToAxis(axis,OBJECTS[j]).min > projectOnToAxis(axis,key).min){
        	OBJECTS[j+1] = OBJECTS[j];
            j--;
        }
        OBJECTS[j+1] = key;
    }
    for(let i = 0; i < l; i++){
        if(active.length > 0){
            for(let j = 0; j < active.length; j++){
                if(collidingOverAxis(active[j],OBJECTS[i],axis)){
                    if(collidingOverAxis(active[j],OBJECTS[i],axis.normal())){
                        let currSat = sat(active[j],OBJECTS[i]);
                        if(currSat){
                            let collData = {
                                penDepth: currSat.penDepth,
                                norm: currSat.axis,
                                cp: getCollPoints(active[j],OBJECTS[i])
                            };
                            COLLISIONS.push([active[j],OBJECTS[i],collData]);
                        }
                    }
                } else {
                    active.splice(j,1);
                    j--;
                }
            }
        }
        active.push(OBJECTS[i]);
    }
    COLLISIONS.forEach(coll => {
        penRes(coll[0],coll[1],coll[2]);
        collRes(coll[0],coll[1],coll[2]);
    });
}

function render(){
    ctx.clearRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
    OBJECTS.forEach(obj => {
        obj.draw();
    });
    JOINED.forEach(pair => {
        pair[0].pos.subtr(pair[1].pos).draw(pair[1].pos.x,pair[1].pos.y,1);
    });
}

function main(){
    for(let i = 0; i < 16; i++){
        physics();
    }
    render();
    updateDeltaT();
}

setInterval(function(){
    document.getElementById('fps').innerHTML = round(fps,1);
},500);
var start = Date.now();
var end;
var fps;
userInput();
setInterval(main);