class StateMachine {
  constructor(transitions, startState) {
    this.transitions = transitions || []
    this.startState = startState
    this.currentState = null
    this.initialized = false
  }

  addTransition(from, to, condition) {
    this.transitions.push({from, to, condition})
  }

  getNextState() {
    if (!this.currentState)
      throw new Error('Machine non yet initialized')

    const transitions = this.transitions.filter(t => t.from === this.currentState)
    if (transitions.length === 0)
      throw new Error('No transition available from current state')

    let nextState = null
    let c = 0
    while (nextState === null && c < transitions.length) {
      if (transitions[c].condition()) {
        nextState = transitions[c].to
      }
      c += 1
    }
    if (!nextState)
      throw new Error('No transtition available: no condition satisfied')

    return nextState
  }

  transition() {
    if (!this.initialized) {
      this.currentState = this.startState
      this.initialized = true
    }

    const nextState = this.getNextState()
    this.currentState = nextState
    return this.currentState
  }
}

module.exports = StateMachine