const welcomePage = document.getElementById("welcomePage")
const marketPage = document.getElementById("marketPage")
const detailsPage = document.getElementById("detailsPage")
const itemPage = document.getElementById("itemPage")
const profilePage = document.getElementById("profilePage")
const checkOutPage = document.getElementById("checkOutPage")
const openingPage = document.getElementById("openingPage")
const slideOne = document.getElementById("slideOne")
const loginPage = document.getElementById("loginPage")
const fogotPasswordPage = document.getElementById("fogotPasswordPage")
const paymentOptionsPage = document.getElementById("paymentOptionsPage")
const resultWindow = document.getElementById("resultWindow")
const detailsWindow = document.getElementById("detailsWindow")
const mother = document.getElementById("mother")
const background = document.getElementById("background")
const performanceChart = document.getElementById("performanceChart")

function changeBackgroundPosition(index){
	if(index == 0){background.style["margin-top"] = "-2%"}
	if(index == 1){background.style["margin-top"] = "-12%"}
	if(index == 2){background.style["margin-top"] = "-24%"}
	if(index == 3){background.style["margin-top"] = "-36%"}
	if(index == 4){background.style["margin-top"] = "-48%"}
	if(index == 5){background.style["margin-top"] = "-60%"}
	if(index == 6){background.style["margin-top"] = "-72%"}
	if(index == 7){background.style["margin-top"] = "-84%"}
	if(index == 8){background.style["margin-top"] = "-96%"}
}



let windowTrack = {
	"lastWindow":openingPage
}



function swapWindows(windowView,delay){
	if(windowTrack.lastWindow == null){
		if(delay == null){			
			windowView.style["display"] = "block"
			setTimeout(()=>{
				windowView.style["opacity"] = "1"
			},30)
		}else{
			windowView.style["display"] = "block"
			setTimeout(()=>{
				windowView.style["opacity"] = "1"
			},delay)
		}
	}else{
		if(delay == null){			
			windowTrack.lastWindow.style["opacity"] = "0"
			setTimeout(()=>{
				setTimeout(()=>{
					windowTrack.lastWindow.style["display"] = "none"
					windowView.style["display"] = "block"
					setTimeout(()=>{
						windowView.style["opacity"] = "1"
					},100)
				},30)
			},300)
		}else{
			windowTrack.lastWindow.style["opacity"] = "0"
			setTimeout(()=>{
				windowTrack.lastWindow.style["display"] = "none"
				windowView.style["display"] = "block"
				setTimeout(()=>{
					windowView.style["opacity"] = "1"
				},delay)
			},30)
		}
	}
	
	windowTrack.lastWindow = windowView
}

function swapText(textView){
	
}

function imagesSlideShow(mainDisplay){
	
}
function loadPieChart(array){
				
				if(array == null){
					array = [
						{
							"name":"red",
							"value":30
						},
						{
							"name":"blue",
							"value":30
						},
						{
							"name":"green",
							"value":40
						},
					]
				}
				
				let intArray = []
				let nameArray = []
				
				for(var i=0; i<array.length; i++){
					let it = array[i]
					let name = it.name
					let value = it.value
					intArray.push(value)
					nameArray.push(name)
				}
				
				let data = {
						datasets: [{
							data: intArray
						}],

						// These labels appear in the legend and in the tooltips when hovering different arcs
						labels: nameArray,
				};
				
				const config = {
				  type: 'doughnut',
				  data: data,
				  options: {
					scales: {
						y: {
							beginAtZero: true
						}
					},
					responsive: true, // Make the chart responsive
					maintainAspectRatio: false // Prevent the chart from maintaining its aspect ratio
				  }
				};
				
				new Chart(performanceChart,config)
}
function runAnimations(){
	openingPage.style.display = "block"
	setTimeout(()=>{
		openingPage.style.opacity = "1"
		setTimeout(()=>{
			slideOne.style.opacity = "1"
			setTimeout(()=>{
				slideOne.style.opacity = "0"
				setTimeout(()=>{
					swapWindows(marketPage,3000)
					changeBackgroundPosition(7)
				},1000)
			},3000)
		},1000)
	},20)
}

window.addEventListener("load",()=>{
	runAnimations()
})