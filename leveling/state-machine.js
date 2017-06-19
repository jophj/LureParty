const MIN_BALLS = 12

class StateMachine {
  constructor(transitions) {
    this.transitions = transitions || []
    this.currentState = null
  }

  init(startState) {
    if (!this.currentState)
      this.currentState = startState
    else throw new Error('Machine already initialized')
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
    while (nextState === null) {
      if (transitions[c].condition()) {
        nextState = transitions[c].to
      }
    }
    if (!nextState)
      throw new Error('No transtition available: no condition satisfied')

    return nextState
  }

  transition() {
    const nextState = this.getNextState()
    this.currentState = nextState
  }
}

const transitions = [
  { from: "start", to: "catch", condition: () => totalExp < 10000 && ballCount >= 12 && catchablePokemons.length > 0 },
  { from: "start", to: "end", condition: () => totalExp >= 10000 },
  { from: "start", to: "farm", condition: () => totalExp < 10000 && ballCount < 12 },
  { from: "start", to: "hunt", condition: () => totalExp < 10000 && ballCount >= 12 && catchablePokemons.length === 0 },
  { from: "catch", to: "catch", condition: () => totalExp < 10000 && ballCount >= 12 && catchablePokemons.length > 0 },
  { from: "catch", to: "farm", condition: () => totalExp < 10000 && ballCount < 12 },
  { from: "catch", to: "hunt", condition: () => totalExp < 10000 && ballCount >= 12 && wildPokemons.length > 0 },
  { from: "catch", to: "end", condition: () => totalExp >= 10000 },
  { from: "farm", to: "catch", condition: () => totalExp < 10000 && ballCount >= 12 && catchablePokemons.length > 0 },
]
const stateMachine = new StateMachine(transitions)
stateMachine.init("start")
ballCount = 12
stateMachine.transition()
console.log(state)



module.exports = stateMachine