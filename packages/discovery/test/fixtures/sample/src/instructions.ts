// A prompt written as plain task instructions — it never says "you are", but it's unmistakably
// addressed to a model: multiple instructional cues (make sure / please / do not / always / step by step).
export const REVIEW_GUIDE = `Make sure to read the diff carefully before commenting. Please do not approve
changes that lack tests, and always explain your reasoning step by step.`
