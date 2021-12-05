import { Link, Slowbro } from "slowbro";
import { FitnessViewModel } from "./fitness_model";

interface FitnessInputControllerInput {
    vm: FitnessViewModel;
}


export class FitnessInputController {
    private vm: FitnessViewModel;
    constructor(public slowbro: Slowbro, input: FitnessInputControllerInput) {
        this.vm = input.vm;
    }
}