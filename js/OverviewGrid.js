class OverviewGrid{
  constructor(samFPler){
    this.app = samFPler;
    this.overviewGridContainer = null;
    this.gridSteps = [];
    this.stepParts = [];
  }
   init(){
     this.overviewGridContainer = document.getElementById("overview-grid");
     for(let i= 0; i<16; i++){
       this.gridSteps[i] = document.createElement("div");
       this.gridSteps[i].classList.add("overview-grid-step");
       this.overviewGridContainer.appendChild(this.gridSteps[i]);
       for(let j = 0; j < 17; j++){
         this.stepParts[(i+1)*j] = document.createElement("div");
         this.stepParts[(i+1)*j].classList.add("step-part", "part"+(i + 1));
         this.gridSteps[i].appendChild(this.stepParts[(i+1)*j]);		
       }
     }
  }
}