/*
 * QStately.js: A JavaScript based finite-state machine (FSM) engine.
 *
 * Copyright (c) 2012 Florian Schäfer (florian.schaefer@gmail.com)
 * Released under MIT license.
 *
 * Modified by Ole Reglitzki
 * See https://github.com/fschaefer/Stately.js for original Stately.js
 *
 * Version 0.1.0
 *
 */

var Q = require("q");

function InvalidStateError(message) {
  this.name = 'InvalidStateError';
  this.message = message;
}

InvalidStateError.prototype = new Error();
InvalidStateError.prototype.constructor = InvalidStateError;

var toString = Object.prototype.toString;

function Stately(statesObject, initialStateName) {
  if (typeof statesObject === 'function') { statesObject = statesObject(); }
  if (toString.call(statesObject) !== '[object Object]') {
    throw new InvalidStateError('Stately.js: Invalid states object: `' + statesObject + '`.');
  }

  var currentState, notificationStore = [];

  function notify() {
    var notifications = notificationStore.slice();
    for (var i = 0, l = notifications.length; i < l; i++) {
      notifications[i].apply(this, arguments);
    }
  }

  function transition(stateName, eventName, nextEvent) {
    return function event() {
      var onBeforeEvent, onAfterEvent, nextState, eventValue = stateMachine;

      if (stateStore[stateName] !== currentState) {
        if (nextEvent) { eventValue = nextEvent.apply(stateStore, arguments); }
        return eventValue;
      }

      onBeforeEvent = stateMachine['onbefore' + eventName];

      if (onBeforeEvent && typeof onBeforeEvent === 'function') {
        onBeforeEvent.call(stateStore, eventName, currentState.name, currentState.name);
      }

      return Q
          .when(stateStore[stateName][eventName].apply(stateStore, arguments))
          .then(function (eventValue) {
            if (typeof eventValue === 'undefined') {
              nextState = currentState;
              eventValue = stateMachine;
            } else if (typeof eventValue === 'string') {
              nextState = stateStore[eventValue];
              eventValue = stateMachine;
            } else if (toString.call(eventValue) === '[object Object]') {
              nextState = (eventValue === stateStore ? currentState : eventValue);
              eventValue = stateMachine;
            } else if (toString.call(eventValue) === '[object Array]' && eventValue.length >= 1) {
              if (typeof eventValue[0] === 'string') {
                nextState = stateStore[eventValue[0]];
              } else {
                nextState = eventValue[0];
              }
              eventValue = eventValue[1];
            }

            onAfterEvent = stateMachine['onafter' + eventName] || stateMachine['on' + eventName];

            if (onAfterEvent && typeof onAfterEvent === 'function') {
              onAfterEvent.call(stateStore, eventName, currentState.name, nextState.name);
            }

            stateStore.setMachineState(nextState, eventName);

            return eventValue;
          });
    };
  }

  var stateStore = {
    getMachineState: function getMachineState() { return currentState.name; },
    setMachineState: function setMachineState(nextState /*, eventName */) {
      var eventName = arguments[1], onEnterState, onLeaveState, lastState = currentState;

      if (typeof nextState === 'string') { nextState = stateStore[nextState]; }

      if (!nextState || !nextState.name || !stateStore[nextState.name]) {
        throw new InvalidStateError('Stately.js: Transitioned into invalid state: `' + setMachineState.caller + '`.');
      }

      currentState = nextState;
      onEnterState = stateMachine['onenter' + currentState.name] || stateMachine['on' + currentState.name];

      if (onEnterState && typeof onEnterState === 'function') {
        onEnterState.call(stateStore, eventName, lastState.name, nextState.name);
      }

      onLeaveState = stateMachine['onleave' + lastState.name];

      if (onLeaveState && typeof onLeaveState === 'function') {
        onLeaveState.call(stateStore, eventName, lastState.name, nextState.name);
      }

      notify.call(stateStore, eventName, lastState.name, nextState.name);
      return this;
    },

    getMachineEvents: function getMachineEvents() {
      var events = [];
      for (var property in currentState) {
        if (currentState.hasOwnProperty(property)) {
          if (typeof currentState[property] === 'function') { events.push(property); }
        }
      }
      return events;
    }
  };

  var stateMachine = {
    getMachineState: stateStore.getMachineState,
    getMachineEvents: stateStore.getMachineEvents,

    bind: function bind(callback) {
      if (callback) { notificationStore.push(callback); }
      return this;
    },

    unbind: function unbind(callback) {
      if (!callback) {
        notificationStore = [];
      } else {
        for (var i = 0, l = notificationStore.length; i < l; i++) {
          if (notificationStore[i] === callback) { notificationStore.splice(i, 1); }
        }
      }
      return this;
    }
  };

  for (var stateName in statesObject) {
    if (statesObject.hasOwnProperty(stateName)) {
      stateStore[stateName] = statesObject[stateName];
      for (var eventName in stateStore[stateName]) {
        if (stateStore[stateName].hasOwnProperty(eventName)) {
          if (typeof stateStore[stateName][eventName] === 'string') {
            stateStore[stateName][eventName] = (function (stateName) {
              return function event() { return this[stateName]; };
            })(stateStore[stateName][eventName]);
          }
          if (typeof stateStore[stateName][eventName] === 'function') {
            stateMachine[eventName] = transition(stateName, eventName, stateMachine[eventName]);
          }
        }
      }
      stateStore[stateName].name = stateName;
      if (!currentState) { currentState = stateStore[stateName]; }
    }
  }

  if (typeof stateStore[initialStateName] !== 'undefined') { currentState = stateStore[initialStateName]; }
  if (!currentState) { throw new InvalidStateError('Stately.js: Invalid initial state.'); }

  return stateMachine;
}

Stately.machine = function machine(statesObject, initialStateName) {
  return new Stately(statesObject, initialStateName);
};

Stately.InvalidStateError = InvalidStateError;

module.exports = Stately;
