/*global Buffer*/
// Named constants with unique integer values
var C = {};
// Tokens
var LEFT_BRACE    = C.LEFT_BRACE    = 0x1;
var RIGHT_BRACE   = C.RIGHT_BRACE   = 0x2;
var LEFT_BRACKET  = C.LEFT_BRACKET  = 0x3;
var RIGHT_BRACKET = C.RIGHT_BRACKET = 0x4;
var COLON         = C.COLON         = 0x5;
var COMMA         = C.COMMA         = 0x6;
var TRUE          = C.TRUE          = 0x7;
var FALSE         = C.FALSE         = 0x8;
var NULL          = C.NULL          = 0x9;
var STRING        = C.STRING        = 0xa;
var NUMBER        = C.NUMBER        = 0xb;
// Tokenizer States
var START   = C.START   = 0x11;
var TRUE1   = C.TRUE1   = 0x21;
var TRUE2   = C.TRUE2   = 0x22;
var TRUE3   = C.TRUE3   = 0x23;
var FALSE1  = C.FALSE1  = 0x31;
var FALSE2  = C.FALSE2  = 0x32;
var FALSE3  = C.FALSE3  = 0x33;
var FALSE4  = C.FALSE4  = 0x34;
var NULL1   = C.NULL1   = 0x41;
var NULL2   = C.NULL3   = 0x42;
var NULL3   = C.NULL2   = 0x43;
var NUMBER1 = C.NUMBER1 = 0x51;
var NUMBER2 = C.NUMBER2 = 0x52;
var NUMBER3 = C.NUMBER3 = 0x53;
var NUMBER4 = C.NUMBER4 = 0x54;
var NUMBER5 = C.NUMBER5 = 0x55;
var NUMBER6 = C.NUMBER6 = 0x56;
var NUMBER7 = C.NUMBER7 = 0x57;
var NUMBER8 = C.NUMBER8 = 0x58;
var STRING1 = C.STRING1 = 0x61;
var STRING2 = C.STRING2 = 0x62;
var STRING3 = C.STRING3 = 0x63;
var STRING4 = C.STRING4 = 0x64;
var STRING5 = C.STRING5 = 0x65;
var STRING6 = C.STRING6 = 0x66;
// Parser States
var VALUE   = C.VALUE   = 0x71;
var KEY     = C.KEY     = 0x72;
// Parser Modes
var OBJECT  = C.OBJECT  = 0x81;
var ARRAY   = C.ARRAY   = 0x82;

function toknam(code) {
  var keys = Object.keys(C);
  for (var i = 0, l = keys.length; i < l; i++) {
    var key = keys[i];
    if (C[key] === code) { return key; }
  }
  return code && ("0x" + code.toString(16));
}


function Parser() {
  this.tState = START;
  this.data = [];
  this.value = undefined;
  this.key = undefined;
  this.mode = undefined;
  this.stack = [];
  this.state = VALUE;
}
var proto = Parser.prototype;
proto.charError = function (buffer, i) {
  this.onError(new Error("Unexpected " + JSON.stringify(String.fromCharCode(buffer[i])) + " at position " + i + " in state " + toknam(this.tState)));
};
proto.onError = function (err) { throw err; };
proto.write = function (buffer) {
  // TODO: Don't require this conversion to accept strings
  // It's probably quite expensive
  if (typeof buffer === 'string') {
    buffer = new Buffer(buffer);
  }
  //process.stdout.write("Input: ");
  //console.dir(buffer.toString());
  var n;
  for (var i = 0, l = buffer.length; i < l; i++) {
    switch (this.tState) {
    case START:
      n = buffer[i];
      switch (n) {
      case 0x7b: this.emitToken(LEFT_BRACE); break; // {
      case 0x7d: this.emitToken(RIGHT_BRACE); break; // }
      case 0x5b: this.emitToken(LEFT_BRACKET); break; // [
      case 0x5d: this.emitToken(RIGHT_BRACKET); break; // ]
      case 0x3a: this.emitToken(COLON); break; // :
      case 0x2c: this.emitToken(COMMA); break; // ,
      case 0x74: this.tState = TRUE1; break; // t
      case 0x66: this.tState = FALSE1; break; // f
      case 0x6e: this.tState = NULL1; break; // n
      case 0x22: this.data.push(n); this.tState = STRING1; break; // "
      case 0x2d: this.data.push(n); this.tState = NUMBER1; break; // -
      case 0x30: this.data.push(n); this.tState = NUMBER2; break; // 0
      default:
        if (n > 0x30 && n < 0x40) { // 1-9
          this.data.push(n); this.tState = NUMBER3;
        } else if (n === 0x20 || n === 0x09 || n === 0x0a || n === 0x0d) {
          // whitespace
        } else { this.charError(buffer, i); }
        break;
      }
      break;
    case STRING1: // After open quote
      n = buffer[i];
      // TODO: Handle native utf8 characters, this code assumes ASCII input
      if (n === 0x22) { this.data.push(n); this.tState = START; this.emitToken(STRING); }
      else if (n === 0x5c) { this.data.push(n); this.tState = STRING2; }
      else { this.data.push(n); }
      break;
    case STRING2: // After backslash
      n = buffer[i];
      switch (n) {
      case 0x22: case 0x5c: case 0x2f: case 0x62: case 0x66: case 0x6e: case 0x72: case 0x74: // "\/bfnrt
        this.data.push(n); this.tState = STRING1; break;
      case 0x75: this.data.push(n); this.tState = STRING3; break;
      default: this.charError(buffer, i); break;
      }
      break;
    case STRING3: case STRING4: case STRING4: case STRING6: // unicode hex codes
      n = buffer[i];
      // 0-9 A-F a-f
      if ((n >= 0x30 && n < 0x40) || (n > 0x40 && n <= 0x46) || (n > 0x60 && n <= 0x66)) {
        this.data.push(n);
        if (this.tState++ === STRING6) { this.tState = STRING1; }
      } else {
        this.charError(buffer, i);
      }
      break;
    case NUMBER1: // after minus
      n = buffer[i];
      if (n === 0x30) { this.data.push(n); this.tState = NUMBER2; }
      else if (n > 0x30 && n < 0x40) { this.data.push(n); this.tState = NUMBER3; }
      else { this.charError(buffer, i); }
      break;
    case NUMBER2: // * After initial zero
      switch (buffer[i]) {
      case 0x2e: this.data.push(0x2e); this.tState = NUMBER4; break; // .
      case 0x65: this.data.push(0x65); this.tState = NUMBER6; break; // e
      case 0x45: this.data.push(0x45); this.tState = NUMBER6; break; // E
      default: this.tState = START; this.emitToken(NUMBER); i--; break;
      }
      break;
    case NUMBER3: // * After digit (before period)
      n = buffer[i];
      switch (n) {
      case 0x2e: this.data.push(0x2e); this.tState = NUMBER4; break; // .
      case 0x65: this.data.push(0x65); this.tState = NUMBER6; break; // e
      case 0x45: this.data.push(0x45); this.tState = NUMBER6; break; // E
      default: 
        if (n >= 0x30 && n < 0x40) { this.data.push(n); }
        else {this.tState = START; this.emitToken(NUMBER); i--; break; }
      }
      break;
    case NUMBER4: // After period
      n = buffer[i];
      if (n >= 0x30 && n < 0x40) { this.data.push(n); this.tState = NUMBER5; } // 0-9
      else { this.charError(buffer, i); }
      break;
    case NUMBER5: // * After digit (after period)
      n = buffer[i];
      if (n >= 0x30 && n < 0x40) { this.data.push(n); } // 0-9
      else if (n === 0x65 || n === 0x45) { this.data.push(n); this.tState = NUMBER6; } // E/e
      else { this.tState = START; this.emitToken(NUMBER); i--; }
      break;
    case NUMBER6: // After E
      n = buffer[i];
      if (n === 0x2b || n === 0x2d) { this.data.push(n); this.tState = NUMBER7; } // +/-
      else if (n >= 0x30 && n < 0x40) { this.data.push(n); this.tState = NUMBER8; } // 0-9  
      else { this.charError(buffer, i); }  
      break;
    case NUMBER7: // After +/-
      n = buffer[i];
      if (n >= 0x30 && n < 0x40) { this.data.push(n); this.tState = NUMBER8; } // 0-9
      else { this.charError(buffer, i); }  
      break;
    case NUMBER8: // * After digit (after +/-)
      n = buffer[i];
      if (n >= 0x30 && n < 0x40) { this.data.push(n); this.tState = NUMBER8; } // 0-9
      else { this.tState = START; this.emitToken(NUMBER); i--; }  
      break;
    case TRUE1: // r
      if (buffer[i] === 0x72) { this.tState = TRUE2; }
      else { this.charError(buffer, i); }
      break;
    case TRUE2: // u
      if (buffer[i] === 0x75) { this.tState = TRUE3; }
      else { this.charError(buffer, i); }
      break;
    case TRUE3: // e
      if (buffer[i] === 0x65) { this.tState = START; this.emitToken(TRUE); }
      else { this.charError(buffer, i); }
      break;
    case FALSE1: // a
      if (buffer[i] === 0x61) { this.tState = FALSE2; }
      else { this.charError(buffer, i); }
      break;
    case FALSE2: // l
      if (buffer[i] === 0x6c) { this.tState = FALSE3; }
      else { this.charError(buffer, i); }
      break;
    case FALSE3: // s
      if (buffer[i] === 0x73) { this.tState = FALSE4; }
      else { this.charError(buffer, i); }
      break;
    case FALSE4: // e
      if (buffer[i] === 0x65) { this.tState = START; this.emitToken(FALSE); }
      else { this.charError(buffer, i); }
      break;
    case NULL1: // u
      if (buffer[i] === 0x75) { this.tState = NULL2; }
      else { this.charError(buffer, i); }
      break;
    case NULL2: // l
      if (buffer[i] === 0x6c) { this.tState = NULL3; }
      else { this.charError(buffer, i); }
      break;
    case NULL3: // l
      if (buffer[i] === 0x6c) { this.tState = START; this.emitToken(NULL); }
      else { this.charError(buffer, i); }
      break;
    }
  }
};
proto.emitToken = function (token) {
  var value;
  if (this.data.length) {
    value = JSON.parse(new Buffer(this.data).toString());
    this.data.length = 0;
  }
  else if (token === TRUE) { value = true; }
  else if (token === FALSE) { value = false; }
  else if (token === NULL) { value = null; }
  this.onToken(token, value);
};
proto.onToken = function (token, value) {
  // Override this to get events
};

proto.parseError = function (token, value) {
  this.onError(new Error("Unexpected " + toknam(token) + (value ? ("(" + JSON.stringify(value) + ")") : "") + " in state " + toknam(this.state)));
};
proto.onError = function (err) { throw err; };
proto.push = function () {
  this.stack.push({value: this.value, key: this.key, mode: this.mode});
};
proto.pop = function () {
  var value = this.value;
  var parent = this.stack.pop();
  this.value = parent.value;
  this.key = parent.key;
  this.mode = parent.mode;
  this.emit(value);
  if (!this.mode) { this.state = VALUE; }
};
proto.emit = function (value) {
  if (this.mode) { this.state = COMMA; }
  this.onValue(value);
};
proto.onValue = function (value) {
  // Override me
};  
proto.onToken = function (token, value) {
  //console.log("OnToken: state=%s token=%s %s", toknam(this.state), toknam(token), value?JSON.stringify(value):"");
  switch (this.state) {
  case VALUE:
    switch (token) {
    case STRING: case NUMBER: case TRUE: case FALSE: case NULL:
      if (this.value) {
        this.value[this.key] = value;
      }
      this.emit(value);
    break;  
    case LEFT_BRACE:
      this.push();
      if (this.value) {
        this.value = this.value[this.key] = {};
      } else {
        this.value = {};
      }
      this.key = undefined;
      this.state = KEY;
      this.mode = OBJECT;
      break;
    case LEFT_BRACKET:
      this.push();
      if (this.value) {
        this.value = this.value[this.key] = [];
      } else {
        this.value = [];
      }
      this.key = 0;
      this.mode = ARRAY;
      this.state = VALUE;
      break;
    case RIGHT_BRACE:
      if (this.mode === OBJECT) {
        this.pop();
      } else {
        this.parseError(token, value);
      }
      break;
    case RIGHT_BRACKET:
      if (this.mode === ARRAY) {
        this.pop();
      } else {
        this.parseError(token, value);
      }
      break;
    default:
      this.parseError(token, value); break;
    }
    break;
  case KEY:
    if (token === STRING) {
      this.key = value;
      this.state = COLON;
    } else if (token === RIGHT_BRACE) {
      this.pop();
    } else {
      this.parseError(token, value);
    }
    break;
  case COLON:
    if (token === COLON) { this.state = VALUE; }
    else { this.parseError(token, value); }
    break;
  case COMMA:
    if (token === COMMA) { 
      if (this.mode === ARRAY) { this.key++; this.state = VALUE; }
      else if (this.mode === OBJECT) { this.state = KEY; }

    } else if (token === RIGHT_BRACKET && this.mode === ARRAY || token === RIGHT_BRACE && this.mode === OBJECT) {
      this.pop();
    } else {
      this.parseError(token, value);
    }
    break;
  default:
    this.parseError(token, value);
  }
};


module.exports = Parser;
