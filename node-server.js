import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
import http from  'http' 
import bodyparser from "body-parser"
const mv = import("mv")
const moveFile = import("move-file")
import {Server} from 'socket.io'
const uri = "mongodb://localhost:27017"
import upload from 'express-file-upload'
import fs from 'fs'
import cors from 'cors';
import {spawn} from "child_process";
const{PassThrough} = import("stream")

import { MongoClient } from 'mongodb'
 
 // Enable command monitoring for debugging
/* 
const mongoClient = new MongoClient('mongodb+srv://shopmatesales:N6Npa7vcMIaBULIS@cluster0.mgv7t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { monitorCommands: true });
mongoClient.connect()// Enable command monitoring for debugging
*/
const mongoClient = new MongoClient(uri, { monitorCommands: true });
mongoClient.connect()// Enable command monitoring for debugging
//server calls management

import express from 'express'


const app = express()

const server = http.createServer(app)

const port = process.env.port || 4000

const ss = import('socket.io-stream')

const io = new Server(server)


app.use(cors())
app.use(express.json({limit:"1mb"}));
app.use(upload());
app.use(express.static(__dirname));
app.use(express.static(__dirname+'/Images'));
app.use(express.static(__dirname+'/Media'));
app.use(express.static(__dirname+'/Assets'));//Date and time
let currentDate;
let currentMonth;
let currentMonthString;
let currentYear;
let currentHours;
let currentMins;

async function allocateTime(){
	
	let date = new Date()
	
	let months = ["January", "February", "March", "April" , "May" , "June" , "July" , "August" , "September" , "October" , "November" , "December"]
	
	currentDate = date.getDate();
	currentMonth = date.getMonth();
	currentYear = date.getFullYear();
	currentMonthString = months[currentMonth];
	currentHours = date.getHours();
	currentMins = date.getMinutes();
	
}

allocateTime()
let dayTrack = 0
let serverTime = {
	"date":currentDate,
	"month":currentMonth,
	"year":currentYear,
	"hours":currentHours,
	"mins":currentMins
};

async function timeProcessor(){
	
	allocateTime()
	
	serverTime["date"] = currentDate,
	serverTime["month"] = currentMonth,
	serverTime["year"] = currentYear,
	serverTime["hours"] = currentHours,
	serverTime["mins"] = currentMins
	
	let d1 = serverTime.date
	let m1 = serverTime.month
	let y1 = serverTime.year
	
	if(
		d1 != dayTrack
	){
		dayTrack = d1
		await EvaluateCatalogue()
		await removeDeletedUsers()
	}
	
	dayTrack = serverTime.date
	
}

async function removeDeletedUsers(){
	try{
		let getUsers = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-profiles"})
		let users = getUsers.body
		let update = false
		for(var i=0; i<users.length;i++){
			let user = users[i]
			if(user.accountStatus === "Deleted" && user.accessPermitted == false){				
				//delete all catalogue except those in completed and uncompleted sales
				let catalogue = user.catalogue
				for(var x=0 ; x<catalogue.length; x++){
					catalogue[x].coverage = false
				}
				EvaluateCatalogue()
			}else{
				
				let d1 = user.dateDeleted.date
				let d2 = serverTime.date
				let difference = d2-d1
				if(difference >= 7){
					user.accessPermitted = false
					update = true
				}
				
			}
		}
		if(update == true){
			await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-profiles"},{$set:{"body":users}})
		}
	}catch{
		
	}
}

setInterval(timeProcessor,1000)

io.on("connection", (socket)=>{
	
	socket.on("nullify-data-transmit",async(data)=>{
		let accessorId = data.accessorId
		let userId = data.userId
		let getSockets = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-sockets"})
		let sockets = getSockets.body 
		
		let socket = sockets.find((sockets)=>{
			return sockets.userId === accessorId
		})
		
		if(socket){
			
			socket["null-user-id"] = userId
			await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-sockets"},{$set:{"body":sockets}})
			
		}
		
	})
	
	socket.on("user-re-instated",(data)=>{
		socket.emit("user-re-instated",data)
	})
	
	socket.on("update-catalogue-quantity",async(data)=>{
	    let itemId = data.itemId 
	    let quantity = data.purchaseQuantity 
	    let getItems = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-items"})
	    let items = getItems.body 
	    let item = items.find((items)=>{
	        items.id === itemId
	    })
	    item.quantityAvailable = item.quantityAvailable-quantity
	    await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-items"},{$set:{"body":items}})
	    socket.emit("catalogue-updated",{
	        "id": item.id,
	        "quantity":item.quantityAvailable
	    })
	})
	
	socket.on("user-suspended",(data)=>{
	    socket.emit("recieve-user-suspended",data)
	})
	
	socket.on("item-deleted",(data)=>{
	    socket.emit("recieve-item-deleted",data)
	})
	
	socket.on("get-online-users",async(data)=>{
	    let accessorId = data.accessorId
	    let socketCheck = await checkIfSocketActive(accessorId)
	    if(socketCheck == true){
	        let getUserSockets = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-sockets"})
	        let sockets = getUserSockets.body
	        
	        let count = 0 
	        
	        for(var i=0; i<sockets.length;i++){
	            let socket = sockets[i]
	            if(socket.active == true){
	                count = count+1
	            }
	        }
	        socket.emit("recieve-online-users",{
	            "users":count
	        })
	    }
	})
	
	socket.on("set-media-params",async(data)=>{
		
		let mediaId = data.mediaId
        let ownerId = data.ownerId
        let format = data.format 
        let userId = data.userId
		
		let getSockets = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-sockets"})
		let sockets = getSockets.body
		
		let socket = sockets.find((sockets)=>{
			return sockets.userId === userId
		})
		
		socket.mediaId = mediaId
		socket.format = format
		socket.ownerId = ownerId
		
		await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-sockets"},{$set:{"body":sockets}})
		
	})
	
	socket.on("send-update-refresh",(data)=>{
		socket.emit("refresh-dispute",data)
	})
	
	socket.on("check-user-active",async(data)=>{
		
		let socketCheck = await checkIfSocketActive(data.accessorId)
		if(socketCheck == true){
			
			let status = await checkIfSocketActive(data.userId)
			
			socket.on("user-active-status",{
				"userId":data.userId,
				"status":status
			})
			
		}
		
	})
	
	//Payment Window Functions 
	socket.on("send-cash-transfer-status",async(data)=>{
		try{
			
			let accessorId = data.accessorId 
			let refCode = data.refCode 
			let status = data.status
			let socketCheck = await checkIfSocketActive(accessorId)
			if(socketCheck == true){
				let getPurchaseData = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-purchase-data"})
				let purchases = getPurchaseData.body
				let purchase = purchases.find((purchases)=>{
					return purchases.id === refCode
				})
				purchase.status = status
				await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-purchase-data"},{$set:{"body":purchases}})				
			}
		}catch{
			
		}
	})
	
	socket.on("get-payment-request",async(data)=>{
		try{
			let accessorId = data.accessorId
			let getSockets = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-sockets"})
			let getUsers = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-profile"})
			let users = getUsers.body 
			let sockets = getSockets.body 
			let socketCheck = await checkIfSocketActive(accessorId)
			
			let user = users.find((users)=>{
				users.id === accessorId
			})
			
			if(user.accountStatus != "Deleted" && user.accountStatus != "Suspended"){
				
				if(socketCheck == true){
					let socket = sockets.find((sockets)=>{
						return sockets.userId === accessorId
					})
					let refCode = socket.currentPurchaseCode
					let getPurchaseData = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-purchase-data"})
					let purchases = getPurchaseData.body
					let purchase = purchases.find((purchases)=>{
						return purchases.id === refCode
					})
					purchase.status = status
					socket.emit("recieve-payment-request",{
						"accessorId":accessorId,
						"data":purchase
					})		
				}
				
			}
			
		}catch{
			
		}
	})

	/////////////////////////////////////////////////////////////View Track Functions///////////////////////////////////////////////////////

	socket.on("log-post-display",async(data)=>{
		try{
			let userId = data.userId
			let post = data.post
			
			let socketCheck = await checkIfSocketActive(userId)
			
			if(socketCheck == true){				
				
				let getViewTrack = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-views-track"})
				let viewTrack = getViewTrack.body
				let userViewTrack = viewTrack.find((viewTrack)=>{
					return viewTrack.userId === userId
				})
				if(userViewTrack){
					userViewTrack.catalogueViewed.push(post)
				}
				await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-views-track"},{$set:{"body":viewsTrack}})
				
				socket.emit("/close-log-post-display",{
					"userId":userId
				})
				
			}
			
		}catch{
			
		}
	})
	
	socket.on("log-post-click",async(data)=>{
		try{
			let userId = data.userId
			let post = data.post
			
			let socketCheck = await checkIfSocketActive(userId)
			
			if(socketCheck == true){				
				
				let getViewTrack = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-views-track"})
				let viewTrack = getViewTrack.body
				let userViewTrack = viewTrack.find((viewTrack)=>{
					return viewTrack.userId === userId
				})
				if(userViewTrack){
					userViewTrack.catalogueClicked.push(post)
					
					for(var i=0; i<userViewTrack.userLogs.length;i++){
						let log = userViewTrack.userLogs[i]
						if(
							log.in.date == serverTime.date &&
							log.in.date == serverTime.month &&
							log.in.date == serverTime.year
						){
							userViewTrack.userLogs[i].postsViewed.push(post)
						}
					}
					
				}
				await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-views-track"},{$set:{"body":viewsTrack}})
				
				socket.emit("/close-log-post-click",{
					"userId":userId
				})
				
			}
			
		}catch{
			
		}
	})
	socket.on("log-post-interested",async(data)=>{
		try{
			let userId = data.userId
			let post = data.post
			
			let socketCheck = await checkIfSocketActive(userId)
			
			if(socketCheck == true){				
				
				let getViewTrack = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-views-track"})
				let viewTrack = getViewTrack.body
				let userViewTrack = viewTrack.find((viewTrack)=>{
					return viewTrack.userId === userId
				})
				if(userViewTrack){
					userViewTrack.interested.push(post)
				}
				await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-views-track"},{$set:{"body":viewsTrack}})
				
				socket.emit("/close-log-post-click",{
					"userId":userId
				})
				
			}
			
		}catch{
			
		}
	})
	
	socket.on("/log-user-login",async(data)=>{
		try{
			let userId = data.userId
			let post = data.post
			
			let socketCheck = await checkIfSocketActive(userId)
			
			if(socketCheck == true){				
				
				let getViewTrack = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-views-track"})
				let viewTrack = getViewTrack.body
				let userViewTrack = viewTrack.find((viewTrack)=>{
					return viewTrack.userId === userId
				})
				let logObject = {
					"in":serverTime,
					"out":serverTime,
					"hours":0.0,
					"postsViewed":[]
				}
				if(userViewTrack){
					userViewTrack.userLogs.push(logObject)
				}
				await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-views-track"},{$set:{"body":viewsTrack}})
				
				socket.emit("/close-log-post-click",{
					"userId":userId
				})
				
			}
			
		}catch{
			
		}
	})
	
	/////////////////////////////////////////////////////////////View Track Functions///////////////////////////////////////////////////////

	
	socket.on("engage-report",(data)=>{
		socket.emit("report-engaged",data)
	})
	
	setInterval(async()=>{
		let getSockets = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-sockets"})
		let getViewTrack = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-views-track"})
		let viewTrack = getViewTrack.body
		
		let sockets = getSockets.body
		
		allocateTime()
		
		for(var i=0; i<sockets.length; i++){
			let socket = sockets[i]
			socket.alreadyLoggedIn = false
			socket.active = false
			let userViewTrack = viewTrack.find((viewTrack)=>{
				return viewTrack.userId === socket.userId
			})
			for(var x=0; userViewTrack.userLogs.length; x++){
				
				let log = userViewTrack.userLogs[x]
				if(
					log.in.date == serverTime.date &&
					log.in.month == serverTime.month &&
					log.in.year == serverTime.year
				){
					userViewTrack.userLogs[x].out = serverTime
				}
				
			}
		}
		await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-views-track"},{$set:{"body":viewsTrack}})
		await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-sockets"},{$set:{"body":sockets}})
		
		socket.emit("ping")
	},7000)
	
	socket.on("ping-back",async(data)=>{
		let userId = data.userId 
		let getSockets = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-sockets"})
		let getViewTrack = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-views-track"})
		let viewTrack = getViewTrack.body
		
		let sockets = getSockets.body
		
		let socket = sockets.find((sockets)=>{
			return sockets.userId === userId
		})
		
		let userViewTrack = viewTrack.find((viewTrack)=>{
			return viewTrack.userId === socket.userId
		})
		
		for(var x=0; userViewTrack.userLogs.length; x++){
				
			let log = userViewTrack.userLogs[x]
			if(
				log.in.date == serverTime.date &&
				log.in.month == serverTime.month &&
				log.in.year == serverTime.year
			){
				userViewTrack.userLogs[x].out = null
			}
			
		}
		
		socket.alreadyLoggedIn = true
		socket.active = true
		await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-views-track"},{$set:{"body":viewsTrack}})
		await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-sockets"},{$set:{"body":sockets}})
		
	})
	
})


setInterval(timeProcessor,1000)

async function maintenanceProcess(){
	let getData = await fetch("https://youthempowermentapp.onrender.com/check-maintenance")
	let data = await getData.json()
	let status = data.status 
	
	console.log("Maintenance Status -->"+status)	
}
	
//setInterval(maintenanceProcess,1000*30)

function createUserDirectories(user){
    var output = false
    var userId = user.userId
    fs.mkdir(__dirname+`/User Data/${userId}`, (error)=>{
        if(!error) {
            fs.mkdir(__dirname+`/User Data/${userId}/Images`, (error)=>{
                if(!error){
                    fs.mkdir(__dirname+`/User Data/${userId}/Data`, (error)=>{
                        if(!error){
                            output = true
						}else{
                            console.log(error)
                        }
                    })
                }else{
                    console.log(error)
                }
            })
        }
    })
    
    return output
}

const addUserSocket = async(userId)=>{
    let activeUsers = await getActiveUsers()
    let newObj = {
        "userId":userId, 
        "postsSelected": [],
        "active": true,
        "mediaId": null,
        "mediaFormat": null,
		"alreadyLoggedIn":true,
		"currentPurchaseCode": null
    }
	
	let newViewTrack = {
		
		"userId":null,
		"catalogueViewed":[],// catalogue displayed to the user
		"catalogueClicked":[],// array of catalogue in which user has tapped on
		"interested":[], // array of catalogue in which user has try to buy or added to cart
		"userLogs":[]//array of user login times
		
	}
    
    activeUsers.push(newObj)
    
    await updateActiveSockets(activeUsers)
}



const checkIfSocketActive = async(userId)=>{
    let output = false
	let getSockets = await mongoClient.db("YEMPData").collection("MainData").findOne({"name":"user-sockets"})
	let getUsers = await mongoClient.db("YEMPData").collection("MainData").findOne({"name":"user-profiles"})
    let users = getUsers.body
    let activeSockets = getSockets.body
    let search = activeSockets.find((activeSockets)=>{
        return activeSockets.userId === userId
    })
    
    
    if(search != null){
		let user = users.find((users)=>{
			users.id === userId
		})
		if(user.accountStatus != "Deleted" || user.accountStatus === "Deleted" && user.accessPermitted == false){			
			if(search.active == true && search.alreadyLoggedIn == true){
				output = true
			}
			let getLeapYear = mongoClient.db("YEMPData").collection("MainData").findOne({"name":"leap-year-status"})
			if(getLeapYear.x == true){			
				if(search.active == true && search.alreadyLoggedIn == true){
					output = true
				}
			}
		}
    }
    
    return output
}

app.post("/process-payment",async(request,response)=>{
	try{
        response.sendFile(__dirname+"/paymentsection.html") 
    }catch{
        response.send(JSON.stringify({"status":"server-error"}))
    }
})

app.post("/sign-up-user",async(request,response)=>{
	try{
		
		let data = request.body
		
		let getUsers = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-profiles"})
		
		let users = getUsers.body
		
		let search = users.find((users)=>{
			return users.emailAddress === data.emailAddress
		})
		
		if(!search){
			
			await addUserSocket(data.id)
			await createUserDirectories(data.id)
			users.push(data)
			await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-profiles"},{$set:{"body":users}})
			response.send(JSON.stringify({"status":"success"}))
			
		}else{
			response.send(JSON.stringify({"status":"email-exists"}))
		}
		
	}catch{
		response.send(JSON.stringify({"status":"server-error"}))
	}
})

app.post("/login-user",async(request,response)=>{
	
	try{
		
		let data = request.body 
		let emailAddress = data.emailAddress
		let password = data.password
		
		let getUsers = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-profiles"})
		let getSockets = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-sockets"})
		let users = getUsers.body
		let sockets = getSockets.body
		
		let user = users.find((users)=>{
			return users.emailAddress === emailAddress
		})
	
		if(user){
			
			if(user.password === password){
					let socket = sockets.find((sockets)=>{
				return sockets.userId === user.id
			})
			
			socket.alreadyLoggedIn = true
			socket.active = true
			
			await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-sockets"},{$set:{"body":sockets}})
			
				response.send(JSON.stringify({"status":"success"}))
			}else{
				response.send(JSON.stringify({"status":"wrong-password"}))
			}
			
		}else{
			response.send(JSON.stringify({"status":"not-found"}))
		}
		
	}catch{
		response.send(JSON.stringify({"status":"server-error"}))
	}
	
})

app.get("/get-user-image/:id", async(request,response)=>{
    try{
        let userId = request.params.id
		let check = await checkIfSocketActive(userId)
        if(check == true){
            let socket = await getUserSocket(userId)
            let mediaId = socket.mediaId
            let mediaFormat = socket.mediaFormat
            let ownerId = socket.ownerId
            let stream = fs.createReadStream(__dirname+`/User Data/${ownerId}/Images/${mediaId}.${mediaFormat}`)
            stream.pipe(response)
        }else{
            response.sendStatus(404)
        }
    }catch{
        response.send(JSON.stringify({"status" : "server-error"}))
    }
}) 

app.get("/get-user-data/:id", async(request,response)=>{
    try{
        let userId = request.params.id
        let checkSocket = await checkIfSocketActive(userId) 
        if( checkSocket == true){
            let socket = await getUserSocket(userId)
            let mediaId = socket.mediaId
            let mediaFormat = socket.mediaFormat
            let ownerId = socket.ownerId
            let stream = fs.createReadStream(__dirname+`/User Data/${ownerId}/Data/${mediaId}.${mediaFormat}`)
            stream.pipe(response)
        }else{
            response.sendStatus(404)
        }
    }catch{
        response.send(JSON.stringify({"status" : "server-error"}))
    }
})

app.post("/check-time",(request,response)=>{
	let data = request.body 
	
	if(
		data.year == serverTime.year &&
		data.month == serverTime.month &&
		data.date == serverTime.date 
	){
		response.send(JSON.stringify({"status":true}))
	}else{
	response.send(JSON.stringify({"status":false}))
	}
})

const updateSale = async(sale)=>{
    
    let output = false
    
    let getUsers = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-profiles"})
    let users = getUsers.body 
    
    for(var i=0; i<users.length; i++){
        let user = users[i]
        let transactions = user.transactions 
        let index = -1
        index = transactions.find((transactions)=>{
            return transactions.id === sale.id
        })
        if(index > -1){
            transactions[index] = sale
        }
    }
    
    output = true
    
    return output
}

app.post("/update-sale",async(request,response)=>{
    try{
        let data = request.body 
        let accessorId = data.accessorId 
        let sale = data.sale 
        let socketCheck = await checkIfSocketActive(accessorId)
        if(socketCheck == true){
            
            let process = await updateSale(sale)
            if(process == true){
                response.send(JSON.stringify({"status":"success"}))
            }else{
                response.send(JSON.stringify({"status":"server-error"}))
            }
            
        }else{
            response.sendStatus(404)
        }
        
    }catch{
        response.send(JSON.stringify({"status":"server-error"}))
    }
})

app.post("/send-notification",async(request,response)=>{
    try{
        
        let data = request.body 
        let notification = data.notification
        let accessorId = data.accessorId
        let recieverId = data.recieverId
        let socketCheck = await checkIfSocketActive(accessorId)
        if(socketCheck == true){
            
            let getUsers = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-profiles"})
            let users = getUsers.body 
            let user = users.find((users)=>{
                return users.id === recieverId
            })
            user.notifications.add(notification)
            
            await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-profiles"},{$set:{"body":users}})
            
        }else{
            response.sendStatus(404)
        }
        
    }catch{
        response.send(JSON.stringify({"status":"server-error"}))
    }
})


app.post("/update-user-data",async(request,response)=>{
	try{
		
		let data = request.body
		
		let socketCheck = await checkIfSocketActive(data.userId)
		
		if(socketCheck == true){
			
			let getUsers = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-profiles"})
			let users = getUsers.body
			
			let index = users.findIndex((users)=>{
				return users.id === data.userId
			})
			
			users[index] = data.data
			
			await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-profiles"},{$set:{"body":users}})
			
			response.send(JSON.stringify({"status":"success"}))
			
		}else{
			response.sendStatus(404)
		}
		
	}catch{
		response.send(JSON.stringify({"status":"server-error"}))
	}
})

app.post("/get-catalogue-by-code", async(request,response)=>{
	
	try{
		let data = request.body 
		let accessorId = data.accessorId 
		let code = data.code 
		
		let socketCheck = await checkIfSocketActive(accessorId)
		
		if(socketCheck == true){
			
			let getCatalogue = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-items"})
			let catalogue = getCatalogue.body
			
			let search = catalogue.find((catalogue)=>{
				return catalogue.code === code
			})
			
			if(search){
				response.send(JSON.stringify({"status":"success","data":search}))
			}else{
				response.send(JSON.stringify({"status":"not-found"}))
			}
			
		}else{
			response.sendStatus(404)
		}
		
	}catch{
		response.send(JSON.stringify({"status":"server-error"}))
	}
	
})

app.post("/add-new-item",async(request,response)=>{
    try{
        
        let data = request.body 
        let userId = data.userId 
        let item = data.item 
        
        let socketCheck = await checkIfSocketActive(userId)
        
        if(socketCheck == true){
            
            let getCatalogue = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-items"})
            let catalogue = getCatalogue.body 
            catalogue.push(item)
            await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-items"},{$set:{"body":catalogue}})
            response.send(JSON.stringify({"status":"success"}))
            
        }else{
            response.sendStatus(404)
        }
        
    }catch{
        response.send(JSON.stringify({"status":"server-error"}))
    }
})

app.post("/get-fresh-catalogue-data",async(request,response)=>{
    try{
        
        let data = request.body 
        let accessorId = data.accessorId 
        let itemId = data.itemId
        
        let socketCheck = await checkIfSocketActive(userId)
        
        if(socketCheck == true){
            
            let getCatalogue = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-items"})
            let catalogue = getCatalogue.body 
            let search = catalogue.find((catalogue)=>{
                return catalogue.id === itemId
            })
            if(search){
                await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-items"},{$set:{"body":catalogue}})
                response.send(JSON.stringify({"status":"success","data":search}))
            }else{
                response.send(JSON.stringify({"status":"server-error"}))
            }
            
        }else{
            response.sendStatus(404)
        }
        
    }catch{
        response.send(JSON.stringify({"status":"server-error"}))
    }
})


app.post("/update-user-item",async(request,response)=>{
    try{
        
        let data = request.body 
        let userId = data.userId 
        let item = data.item 
        
        let socketCheck = await checkIfSocketActive(userId)
        
        if(socketCheck == true){
            
            let getCatalogue = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-items"})
            let catalogue = getCatalogue.body 
            let index = catalogue.find((catalogue)=>{
                return catalogue.id === item.id 
            })
            catalogue[index] = item
            await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-items"},{$set:{"body":catalogue}})
            response.send(JSON.stringify({"status":"success"}))
            
        }else{
            response.sendStatus(404)
        }
        
    }catch{
        response.send(JSON.stringify({"status":"server-error"}))
    }
})

app.post("/create-admin-directories", async(request,response)=>{
    try{
        let data = request.body 
        let adminId = data.adminId
        let accessorId = data.accessorId 
        let socketCheck = await checkIfSocketActive(accessorId)
        if(socketCheck == true){
            
            let create = await createUserDirectories(adminId)
            if(create == true){
                response.send(JSON.stringify({"status":"success"}))
            }
            
        }else{
            response.sendStatus(404)
        }
    }catch{
        response.send(JSON.stringify({"status":"server-error"}))
    }
})

app.post("/update-admin-data", async(request,response)=>{
    try{
        let data = request.body 
        let userId = data.accessorId 
        let socketCheck = await checkIfSocketActive(userId)
        if(socketCheck == true){
            
            let adminData = data.data 
            await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"admin-data-controller"},{$set:{"body":adminData}})
            response.send(JSON.stringify({"status":"success"}))
            
        }else{
            response.sendStatus(404)
        }
    }catch{
        response.send(JSON.stringify({"status":"server-error"}))
    }
})

app.post("/get-admin-data", async(request,response)=>{
    try{
        let data = request.body 
        let adminId = data.accessorId 
        let socketCheck = await checkIfSocketActive(adminId)
        if(socketCheck == true){
            
            let getData = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"admin-data-controller"})
            let adminData = getData.body 
            response.send(JSON.stringify({"status":"success","data":adminData}))
            
        }else{
            response.sendStatus(404)
        }
    }catch{
        response.send(JSON.stringify({"status":"server-error"}))
    }
})

app.post("/upload-purchase-data",async(request,response)=>{
	try{
		let data = request.body 
		let accessorId = data.accessorId 
		let purchaseData = data.purchaseData
		let socketCheck = await checkIfSocketActive(accessorId)
		if(socketCheck == true){
			let getPurchaseData = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-purchase-data"})
			let purchases = getPurchaseData.body
			purchases.push(purchaseData)
			await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-purchase-data"},{$set:{"body":purchases}})
			response.send(JSON.stringify({"status":"success"}))
		}else{
			response.send(JSON.stringify({"status":"server-error"}))
		}
	}catch{
		response.send(JSON.stringify({"status":"server-error"}))
	}
})

app.put("/get-payment-status",async(request,response)=>{
	try{
		let data = request.body 
		let accessorId = data.accessorId 
		let code = data.code
		let socketCheck = await checkIfSocketActive(accessorId)
		if(socketCheck == true){
			let getPurchaseData = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-purchase-data"})
			let purchases = getPurchaseData.body
			let search = purchases.find((purchases)=>{
				return purchases.id === code
			})
			response.send(JSON.stringify({"status":search.status}))
		}else{
			response.send(JSON.stringify({"status":"server-error"}))
		}
	}catch{
		response.send(JSON.stringify({"status":"server-error"}))
	}
})

app.post("/get-categories",async(request,response)=>{
	try{
		
		let data = request.body 
		let accessorId = data.accessorId 
		let socketCheck = await checkIfSocketActive(accessorId)
		if(socketCheck == true){
		    let process = await GetCategories()
		    response.send(JSON.stringify({"status":"success","data":process}))
		}else{
		    response.send(JSON.stringify({"status":"server-error"}))
		}
	}catch{
		response.send(JSON.stringify({"status":"server-error"}))
	}
})

async function sortPostsByViews(collection,ascending){
	if(ascending == false){		
		collection.sorted((a,b)=>{b.numberOfViews - a.numberOfViews})
	}else{
		collection.sorted((a,b)=>{a.numberOfViews - b.numberOfViews})
	}
	return collection
}

async function GetCategories(){
    let output = []
    try{
        let getPosts = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-items"})
	    let posts = getPosts.body
	    for(var i=0; i<posts.length;i++){
	        let post = posts[i]
	        let category = post.category 
	        if(output.includes(category) == false){
	            output.push(category)
	        }
	    }
    }catch{
        
    }
    return output
}

async function ProcessMainFeed(catalogue,accessorId){
    
    let getViewTrack = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-views-track"})
    let getPosts = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-items"})
	let posts = getPosts.body
    let viewTrack = getViewTrack.body 
    
    let userViewTrack = viewTrack.find((viewTrack)=>{
        return viewTrack.userId === accessorId
    })
    
    let postsViewed = []
    let selectedLogs = []
    let selectedCategories = []
    
	function checkCategories(category){
		let output = false
		for(var i=0; i<selectedCategories.length; i++){
			let target = selectedCategories[i].name
			if(target == category){
				output = true 
				break
			}
		}
		return output
	}
	
    let logs = userViewTrack.userLogs
    
    
    
    for(var i=0; i<logs.length; i++){
        let log = log[i]
        let pv = log.pv
        
        //get posts viewed between the current month and 3 months ago but within the current year
        if((serverTime.month-2) >= 0){			
			if(
				log.in.month == serverTime.month ||
				log.in.month == serverTime.month-1 ||
				log.in.month == serverTime.month-2 &&
				log.in.year == serverTime.year
				){
				selectedLogs.push(log)
			}
		}else{
			if(
				log.in.month == serverTime.month ||
				log.in.month == serverTime.month-1 ||
				log.in.month == 11 &&
				log.in.year == serverTime.year ||
				log.in.year == serverTime.year-1
				){
				selectedLogs.push(log)
			}
		}
    }
	
	//get posts from selected logs 
	
	for(var i=0; i<selectedLogs.length; i++){
		let log = selectedLogs[i]
		let pv = log.postsViewed
		for(var x=0; x<pv.length; x++){
			let post = pv[x]
			postsViewed.push(post)
		}
	}
	
	//get all categories and the number of hits 
	for(var i=0;i<postsViewed.length; i++){
		
		let post = postsViewed[i]
		
		let category = post.category 
		
		let check = checkCategories(category)
		
		if(check == false){
			selectedCategories.push({
				"name":category,
				"hits":1
			})
		}else{
			let target = selectedCategories.find((selectedCategories)=>{
				return selectedCategories.name === category
			})
			target.hits = target.hits+1
		}
	}
    //arrange selected categories for hits 
	
	selectedCategories.sorted((a,b)=>{b.hits - a.hits})
	
	let selectedPosts = []
	
	let newPosts = []
	
	for(var i=0;i<selectedCategories.length; i++){
		let cat = selectedCategories[i]
		let name = cat.name 
		for(var x=0;x<posts.length;x++){
			let post = posts[x]
			if(post.category === name){
				selectedPosts.push(post)
			}
		}
	}
	
	//isolate new posts --> get posts atleast 1 to 3 days old

	for(var i=0; i<selectedPosts.length; i++){
		let post = selectedPosts[i]
		if(
			post.dateModified.date == serverTime.date &&
			post.dateModified.month == serverTime.date &&
			post.dateModified.year == serverTime.year 
		){
			newPosts.push(post)
			selectedPosts.splice(i,1)
		}
		if((serverTime.date-2) >= 0){			
			if(
				post.dateModified.date == serverTime.date-2 &&
				post.dateModified.month == serverTime.date &&
				post.dateModified.year == serverTime.year 
			){
				newPosts.push(post)
				selectedPosts.splice(i,1)
			}
		}else{
			if(
				post.dateModified.date <= 31 &&
				post.dateModified.month <= serverTime.date &&
				post.dateModified.year == serverTime.year 
			){
				newPosts.push(post)
				selectedPosts.splice(i,1)
			}
		}
	}
	
	
	
	let sortedPosts = await sortPostsByViews(selectedPosts,false)
	
	let currentTrack = 0
	
	newPosts.sorted((a,b)=>{
		b.numberOfViews-a.numberOfViews
	})
	
	for(var i=0; i<sortedPosts.length;i++){
		if(i == currentTrack){
			if(newPosts.length > 0){				
				if(i != sortedPosts.length-1){
					sortedPosts.splice(i,0,newPosts[0])
					let newTrack = i + 2
					if(newTrack <= sortedPosts.length-1){
						currentTrack = newTrack
					}else{
						currentTrack = sortedPosts.length-1
					}
				}else{
					sortedPosts.push(newPosts[0])
				}
				newPosts.splice(0,1)
			}
		}
	}
	
    return sortedPosts
}

function checkItemQuantity(item){
    let output = false
    if(item.quantityAvailable > 0){
        output = true
    }
    return output
}

async function GetTrendingItems(accessorId){
    let output = []
    
    //get top items from every catalogue category which everyone is looking at
    
    let getViewTrack = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-views-track"})
    let getPosts = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-items"})
	let posts = getPosts.body
    let viewTrack = getViewTrack.body 
    
    let clickedCatalogue = []
    
    for(var i=0; i<viewsTrack.length; i++){
        if(compareUsers(accessorId,viewsTrack[i].userId) == true){
            let collection = viewsTrack[i].catalogueViewed
            for(var x=0; x<collection.length; x++){
                let item = collection[x]
                let search = clickedCatalogue.find((clickedCatalogue)=>{
                    return clickedCatalogue.id === item.id
                })
                if(!search){
                    clickedCatalogue.push({
                        "id":item.id,
                        "item":item,
                        "hits":1
                    })
                }else{
                    let newHits = search.hits+1
                    search.hits = newHits
                }
            }
        }
    }
    
    
    clickedCatalogue.sorted((a,b)=>{
        b.hits - a.hits
    })
    
    for(var i=0; i<clickedCatalogue.length; i++){
        let item = clickedCatalogue[i]
        let freshItem = posts.find((posts)=>{
            return posts.id === item.id
        })
        if(checkItemQuantity(freshItem) == true){
            output.push(freshItem)
        }
    }
    
    return output
}

async function GetTopItems(accessorId){
    let output = []
    
    //get top items from every catalogue category which everyone is looking at
    
    let getViewTrack = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-views-track"})
    let getPosts = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-items"})
	let posts = getPosts.body
    let viewTrack = getViewTrack.body 
    
    let interestedCatalogue = []
    
    for(var i=0; i<viewsTrack.length; i++){
        if(await compareUsers(accessorId,viewsTrack[i].userId) == true){
            let collection = viewsTrack[i].interested
            for(var x=0; x<collection.length; x++){
                let item = collection[x]
                let search = interestedCatalogue.find((interestedCatalogue)=>{
                    return interestedCatalogue.id === item.id
                })
                if(!search){
                    interestedCatalogue.push({
                        "id":item.id,
                        "item":item,
                        "hits":1
                    })
                }else{
                    let newHits = search.hits+1
                    search.hits = newHits
                }
            }
        }
    }
    
    interestedCatalogue.sorted((a,b)=>{
        b.hits - a.hits
    })
    
    for(var i=0; i<interestedCatalogue.length; i++){
        let item = interestedCatalogue[i]
        let freshItem = posts.find((posts)=>{
            return posts.id === item.id
        })
        if(checkItemQuantity(freshItem) == true){
            output.push(freshItem)
        }
    }
    
    return output
}


app.post("/get-trending-items",async(request,response)=>{
	try{
		let data = request.body 
		let accessorId = data.accessorId
		let socketCheck = await checkIfSocketActive(accessorId)
		if(socketCheck == true){
		    
		    let process = await GetTrendingItems(accessorId)
		    response.send(JSON.stringify({"status":"success","data":process}))
		    
		}else{
		    response.send(JSON.stringify({"status":"server-error"}))
		}
	}catch{
		response.send(JSON.stringify({"status":"server-error"}))
	}
})

app.post("/get-all-items",async(request,response)=>{
	try{
		let data = request.body 
		let accessorId = data.accessorId
		let socketCheck = await checkIfSocketActive(accessorId)
		if(socketCheck == true){
		    let getCatalogue = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-items"})
            let catalogue = getCatalogue.body 
            
            let process = await ProcessMainFeed(catalogue,accessorId)
            
            response.send(JSON.stringify({"status":"success","data":process}))
		}
	}catch{
		response.send(JSON.stringify({"status":"server-error"}))
	}
})
app.post("/get-top-items",async(request,response)=>{
	try{
		let data = request.body 
		let accessorId = data.accessorId
		let socketCheck = await checkIfSocketActive(accessorId)
		if(socketCheck == true){
		    
		    let process = await GetTopItems(accessorId)
		    response.send(JSON.stringify({"status":"success","data":process}))
		    
		}else{
		    response.send(JSON.stringify({"status":"server-error"}))
		}
	}catch{
		response.send(JSON.stringify({"status":"server-error"}))
	}
})

async function compareUsers(accessorId,targetId){
    let output = false
    try{
        let getUserProfiles = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-profiles"})
        let userProfiles = getUserProfiles.body 
        let accessor = userProfiles.find((userProfiles)=>{
            return userProfiles.id === accessorId
        })
        let accessorCategories = accessor.preferredCategories
        let user = userProfiles.find((userProfiles)=>{
            return userProfiles.id === targetId
        })
        
        var catCount = 0
        
        if(user){
            let categories = user.preferredCategories 
            for(var i=0; i<categories.length;i++){
                let category = categories[i]
                if(accessorCategories.includes(category) == true){
                    catCount = catCount+1
                }
                if(catCount >= 3){
                    output = true
                }
            }
            
            if(
                accessor.addressDetails.city === user.addressDetails.city &&
                accessor.addressDetails.country === user.addressDetails.country
            ){
                output = true
            }
        }
        
    }catch{
        
    }
    return output
}

async function searchActiveSales(targetItem){
    let output = false
    
    let getUsers = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-profiles"})
    let users = getUsers.body 
    for(var i = 0; i<users.length; i++){
        let user = users[i]
        let transactions = user.transactions
        for(var x=0;x<transactions.length;x++){
            let t = transactions[x]
            if(t.status == "Pending" || t.status == "Under Review"){
                let items = t.items 
                for(var y=0;y<items.length;y++){
                    let item = items[y]
                    if(item.item.id == targetItem.id){
                        output.true
                    }
                }
            }
        }
    }
    
    return output
}

async function deleteImages(item){
    let output = null
    
    try{
        let images = item.images 
        for(var i=0;i<images.length;i++){
            let image = images[i]
            let mediaId = image.id 
            let format = image.format
            let ownerId = image.ownerId
            fs.deleteSync(__dirname+`/User Data/${ownerId}/Images/${mediaId}.${mediaFormat}`)
        }
        output = true
    }catch{
        output = false
    }
}

async function EvaluateCatalogue(){
	try{
		let getCatalogue = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-items"})
		let catalogue = getCatalogue.body 
		let getUsers = mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-profiles"})
		let users = getUsers.body 
		
		let checkUsers = (item)=>{
			let output = true
			for(var i=0; i <users.length; i ++){
				let user = users[i]
				let transactions = user.transactions
				for(var x=0; x<transactions.length;x++){
					let transaction = transactions[x]
					let items = transaction.items					
					let search = items.find((items)=>{
						return items.item.id === item.id
					})
					if(search){
						output = true
						break
					}
 				}
			}
			return output
		}
		
		for(var i=0 ; i<catalogue.length; i++){
			let item = catalogue[i]
			if(item.coverage == false){
				if(checkUsers(item) == true){
					//delete all media items 
					let images = item.images
					let imageCount = 0
					for(var x=0; x<images.length; x++){
						let image = images[x]
						let id = image.id 
						let format = image.format 
						let ownerId = ownerId
						fs.delete(__dirname+`/User Data/${ownerId}/Images/${id}.${format}`,(error)=>{
							if(error){
								console.log(error)
							}else{
								imageCount = imageCount+1
							}
						})
					}
					if(imageCount == images.length){
						catalogue.splice(i,1)
					}
				}
			}
		}
		await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-items"},{$set:{"body":catalogue}})
	}catch{
		
	}
}

app.post("/delete-item",async(request,response)=>{
    try{
        
        let data = request.body 
        let accessorId = data.accessorId
        let itemId = data.itemId 
        
        let socketCheck = await checkIfSocketActive(accessorId)
        if(socketCheck == true){
            
            let getItems = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-items"})
            let items = getItems.body 
            let item = items.find((items)=>{
                return items.id === itemId
            })
            let itemIndex = items.findIndex((items)=>{
                return items.id === itemId
            })
            let search = await searchActiveSales(item)
            if(search == true){
                item.coverage = false
                await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-items"},{$set:{"body":items}})
                response.send(JSON.stringify({"status":"success"}))
            }else{
                //delete data 
                if(await deleteImages(item.images) == true){
                    item.dateModified = serverTime
                    items[itemIndex] = item
                    await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-items"},{$set:{"body":items}})
                    response.send(JSON.stringify({"status":"success"}))
                }else{
                    response.send(JSON.stringify({"status":"server-error"}))
                }
            }
        }else{
            response.send(JSON.stringify({"status":"server-error"}))
        }
        
    }catch{
        response.send(JSON.stringify({"status":"server-error"}))
    }
})

///////////////////////////////////////Performance Functions//////////////////////////////////////////////////////

async function generateConsumptionData(viewsTrack,limitDate){
	let output = {}
	
	let collection = []
    
    for(var i=0; i<viewsTrack.length; i++){
        let track = viewsTrack[i]
        let userLogs = track.userLogs
        for(var x=0; x < userLogs.length; x++){
            let log = userLogs[x]
            if(
                log.in.month <= limitDate.month &&
                log.in.year == limitDate.year
                ){
                if(log.in.month == limitDate.month){
                    if(log.in.date <= limitDate.date){
                        collection.push(log)
                    }
                }else{
                    collection.push(log)
                }
            }
            
        }
    }
    let sun = 0
    let mon = 0
    let tue = 0
    let wed = 0
    let thur = 0
    let fri = 0
    let sat = 0
        
    let sunx = 0
    let monx = 0
    let tuex = 0
    let wedx = 0
    let thurx = 0
    let frix = 0
    let satx = 0
        
    for(var i=0; i<collection.length;i++){
        let log = collection[i]
        if(log.in.day == 0){
            let hours = log.in.hours -log.out.hours
            sun = hours
            sunx = sunx+1
        }
        if(log.in.day == 1){
            let hours = log.in.hours -log.out.hours
            mon = hours
            monx = monx+1
        }
        if(log.in.day == 2){
            let hours = log.in.hours -log.out.hours
            tue = hours
            tuex = tuex+1
        }
        if(log.in.day == 3){
            let hours = log.in.hours -log.out.hours
            wed = hours
            wedx = wedx+1
        }
        if(log.in.day == 4){
            let hours = log.in.hours -log.out.hours
            thur = hours
            thurx = thurx+1
        }
        if(log.in.day == 5){
            let hours = log.in.hours -log.out.hours
            fri = hours
            frix = frix+1
        }
        if(log.in.day == 6){
            let hours = log.in.hours -log.out.hours
            sat = hours
            satx = satx+1
        }
            
    }
        
        for(var i=0; i<collection.length;i++){
            
            let log = collection[i]
            if(log.in.day == 0){
                let hours = log.in.hours -log.out.hours
                output["Sun"] = sun/sunx
            }
            if(log.in.day == 1){
                let hours = log.in.hours -log.out.hours
                output["Mon"] = mon/monx
            }
            if(log.in.day == 2){
                let hours = log.in.hours -log.out.hours
                output["Tue"] = tue/tuex
            }
            if(log.in.day == 3){
                let hours = log.in.hours -log.out.hours
                output["Wed"] = wed/wedx
            }
            if(log.in.day == 4){
                let hours = log.in.hours -log.out.hours
                output["Thur"] = thur/thurx
            }
            if(log.in.day == 5){
                let hours = log.in.hours -log.out.hours
                output["Fri"] = fri/frix
            }
            if(log.in.day == 6){
                let hours = log.in.hours -log.out.hours
                output["Sat"] = sat/satx
            }
            
        }
	return output
}
async function generateCategoryPerformanceData(viewsTrack){
	
    let collection = []
    
    let cc = 0
    let vc = 0 
    let ic = 0
    
    for(var i=0; i<viewsTrack.length; i++){
        let track = viewsTrack[i]
        let clicked = viewsTrack[i].catalogueClicked
        for(var x=0; x<clicked; x++){
            let category = clicked[x].category
            let search = collection.find((collection)=>{
                return collection.name === category
            })
            if(!search){
                collection.push(
                    {
                        "name":category,
                        "clicks":1,
                        "interested":0,
                        "views":0,
                        "userConsumption":0
                    }
                )
                cc = cc+1
            }else{
                search.clicks = search.clicks+1
                cc = cc+1
            }
        }
    }
    
    for(var i=0; i<viewsTrack.length; i++){
        let track = viewsTrack[i]
        let interested = viewsTrack[i].interested
        for(var x=0; x<interested; x++){
            let category = interested[x].category
            let search = collection.find((collection)=>{
                return collection.name === category
            })
            if(!search){
                collection.push(
                    {
                        "name":category,
                        "clicks":0,
                        "interested":1,
                        "views":0,
                        "userConsumption":0
                    }
                )
                ic = ic+1
            }else{
                search.interested = search.interested+1
                ic = ic+1
            }
        }
    }
    
    for(var i=0; i<viewsTrack.length; i++){
        let track = viewsTrack[i]
        let views = viewsTrack[i].catalogueViewed
        for(var x=0; x<views; x++){
            let category = views[x].category
            let search = collection.find((collection)=>{
                return collection.name === category
            })
            if(!search){
                collection.push(
                    {
                        "name":category,
                        "clicks":0,
                        "interested":0,
                        "views":1,
                        "userConsumption":0
                    }
                )
                vc = vc+1
            }else{
                search.views = search.views+1
                vc = vc+1
            }
        }
    }
    
    let totalConsumption = 0
    
    for(var i=0; i<collection.length;i++){
        let item = collection[i]
        totalConsumption = totalConsumption+item.clicks
    }
    
    for(var i=0; i<collection.length;i++){
        let item = collection[i]
        item.userConsumption  = item.clicked/totalConsumption
    }
    
    for(var i=0; i<collection.length;i++){
        let item = collection[i]
        item.views  = item.views/vc
        item.clicks  = item.clicks/cc
        item.interested  = item.interested/ic
    }
    
    collection.sorted((a,b)=>{
        b.userConsumption - a.userConsumption
    })
    
	return collection
}
async function generateLogData(viewsTrack,limitDate){
    let output = {}
    
    let collection = []
    
    for(var i=0; i<viewsTrack.length; i++){
        let track = viewsTrack[i]
        let userLogs = track.userLogs
        for(var x=0; x < userLogs.length; x++){
            let log = userLogs[x]
            if(
                log.in.month <= limitDate.month &&
                log.in.year == limitDate.year
                ){
                if(log.in.month == limitDate.month){
                    if(log.in.date <= limitDate.date){
                        collection.push(log)
                    }
                }else{
                    collection.push(log)
                }
            }
            
        }
    }
    
    for(var i=0; i < collection.length; i++){
        let log = collection[i]
        let x = log.ins
        let hour = x.hour
        if(hour == 0){
            let newValue = output["0 hrs"] + 1.0
            output["0 hrs"] = newValue
        }
        if(hour == 1){
            let newValue = output["1 hrs"] + 1.0
            output["1 hrs"] = newValue
        }
        if(hour == 2){
            let newValue = output["2 hrs"] + 1.0
            output["2 hrs"] = newValue
        }
        if(hour == 3){
            let newValue = output["3 hrs"] + 1.0
            output["3 hrs"] = newValue
        }
        if(hour == 4){
            let newValue = output["4 hrs"] + 1.0
            output["4 hrs"] = newValue
        }
        if(hour == 5){
            let newValue = output["5 hrs"] + 1.0
            output["5 hrs"] = newValue
        }
        if(hour == 6){
            let newValue = output["6 hrs"] + 1.0
            output["6 hrs"] = newValue
        }
        if(hour == 7){
            let newValue = output["7 hrs"] + 1.0
            output["7 hrs"] = newValue
        }
        if(hour == 8){
            let newValue = output["8 hrs"] + 1.0
            output["8 hrs"] = newValue
        }
        if(hour == 9){
            let newValue = output["9 hrs"] + 1.0
            output["9 hrs"] = newValue
        }
        if(hour == 10){
            let newValue = output["10 hrs"] + 1.0
            output["10 hrs"] = newValue
        }
        if(hour == 11){
            let newValue = output["11 hrs"] + 1.0
            output["11 hrs"] = newValue
        }
        if(hour == 12){
            let newValue = output["12 hrs"] + 1.0
            output["12 hrs"] = newValue
        }
        if(hour == 13){
            let newValue = output["13 hrs"] + 1.0
            output["13 hrs"] = newValue
        }
        if(hour == 14){
            let newValue = output["14 hrs"] + 1.0
            output["14 hrs"] = newValue
        }
        if(hour == 15){
            let newValue = output["15 hrs"] + 1.0
            output["15 hrs"] = newValue
        }
        if(hour == 16){
            let newValue = output["16 hrs"] + 1.0
            output["16 hrs"] = newValue
        }
        if(hour == 17){
            let newValue = output["17 hrs"] + 1.0
            output["17 hrs"] = newValue
        }
        if(hour == 18){
            let newValue = output["18 hrs"] + 1.0
            output["18 hrs"] = newValue
        }
        if(hour == 19){
            let newValue = output["19 hrs"] + 1.0
            output["19 hrs"] = newValue
        }
        if(hour == 20){
            let newValue = output["20 hrs"] + 1.0
            output["20 hrs"] = newValue
        }
        if(hour == 21){
            let newValue = output["21 hrs"] + 1.0
            output["21 hrs"] = newValue
        }
        if(hour == 22){
            let newValue = output["22 hrs"] + 1.0
            output["22 hrs"] = newValue
        }
        if(hour == 23){
            let newValue = output["23 hrs"] + 1.0
            output["23 hrs"] = newValue
        }
    }
    
    return output
    
}
async function generateShareData(viewsTrack,limitDate){
    let output = {}
    
    let collection = []
    
    for(var i=0; i<viewsTrack.length; i++){
        let track = viewsTrack[i]
        let clicked = viewsTrack[i].catalogueClicked
        for(var x=0; x<clicked; x++){
            let category = clicked[x].category
            let search = collection.find((collection)=>{
                return collection.name === category
            })
            if(!search){
                collection.push(
                    {
                        "name":category,
                        "hits":1
                    }
                )
            }else{
                search.hits = search.hits+1
            }
        }
    }
    
    let total = 0
    
    for(var i=0; i<collection.length; i++){
        let item = collection[i]
        total = total+item.hits
    }
    
    for(var i=0; i<collection.length;i++){
        let item = collection[i]
        output[item.name]  = item.hits/total
    }
    
    return output
}

///////////////////////////////////////Performance Functions//////////////////////////////////////////////////////


app.post("/get-category-share-data",async(request,response)=>{
	try{
		
		let data = request.body 
		let limitDate = data.limitDate
		
		let check = await socketCheck(data.accessorId)
		
		if(check == true){			
			let getUserViewsTrack = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-views-track"})
			let viewsTrack = getUserViewsTrack.body
			let shares = await generateShareData(viewsTrack,limitDate)
			response.send(JSON.stringify({"status":"success","data":shares}))
		}else{
			response.send(JSON.stringify({"status":"server-error"}))
		}
		
		
	}catch{
		response.send(JSON.stringify({"status":"server-error"}))
	}
})


app.post("/get-user-logons",async(request,response)=>{
	try{
		
		let data = request.body 
		let limitDate = data.limitDate 
		
		let check = await socketCheck(data.accessorId)
		
		if(check == true){			
			let getUserViewsTrack = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-views-track"})
			let viewsTrack = getUserViewsTrack.body
			let logons = await generateLogData(viewsTrack,limitDate)
			response.send(JSON.stringify({"status":"success","data":logons}))
		}else{
			response.send(JSON.stringify({"status":"server-error"}))
		}
		
		
	}catch{
		response.send(JSON.stringify({"status":"server-error"}))
	}
})
app.post("/get-user-consumption",async(request,response)=>{
	try{
		
		let data = request.body 
		let limitDate = data.limitDate
		
		let check = await socketCheck(data.accessorId)
		
		if(check == true){			
			let getUserViewsTrack = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-views-track"})
			let viewsTrack = getUserViewsTrack.body
			let output = await generateConsumptionData(viewsTrack,limitDate)
			response.send(JSON.stringify({"status":"success","data":output}))
		}else{
			response.send(JSON.stringify({"status":"server-error"}))
		}
		
		
	}catch{
		response.send(JSON.stringify({"status":"server-error"}))
	}
})

async function genCatPerformanceData(viewsTrack){
	let output = []
	
	let categoryCollection = []
	
	for(var i=0; i<viewsTrack.length; i++){
		
		let viewed = viewsTrack[i].catalogueViewed
		let clicked = viewsTrack[i].catalogueClicked
		let interested = viewsTrack[i].interested
		
		for(var x=0; x<views.length;x++){
			
		}
		
	}
	
	return output
}

app.post("/get-category-performance-data",async(request,response)=>{
	try{
		
		let data = request.body 
		
		let check = await socketCheck(data.accessorId)
		
		if(check == true){			
			let getUserViewsTrack = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-views-track"})
			let viewsTrack = getUserViewsTrack.body
			let output = await genCatPerformanceData(viewsTrack)
			response.send(JSON.stringify({"status":"success","data":output}))
		}else{
			response.send(JSON.stringify({"status":"server-error"}))
		}
		
	}catch{
		response.send(JSON.stringify({"status":"server-error"}))
	}
})

/////////////////////////////////////////////////>>Paypal Functions<<///////////////////////////////////////////////////
	async function createPaypalOrder(controller,email,time) {
	
		const accessToken = await generateAccessToken();
		
		console.log(accessToken)
		
		let response =  await fetch ("https://api-m.paypal.com/v2/checkout/orders", {
		
			method: "POST",
		
			headers: {
		
			"Content-Type": "application/json",
		
			"Authorization": `Bearer ${accessToken}`,
		
			},
		
			body: JSON.stringify({
		
			"purchase_units": [
		
				{
		
				"amount": {
		
					"currency_code": "USD",
		
					"value": `${controller.currentValue}.00`
		
				},
				
				"reference_id": `${generateOrderReferenceCode(controller,email)}`
		
				}
		
			],
		
			"intent": "CAPTURE"
			})
		
		});
		
		return response.json()
	
	}
	
	
	
	app.post('/create-paypal-order', async(request,response)=>{
		
		try{
			
			let incoming = request.body;
			
			let controller = incoming.controller;
			
			let time = incoming.time
			
			console.log(controller)
			
			let email = incoming.email;
		
			let userId = incoming.userId
			
			let createOrder = await createPaypalOrder(controller,email,time);
			
			console.log(createOrder)
								
			if(createOrder){
				response.send(JSON.stringify(createOrder))
			}else{
				response.send(JSON.stringify({"status":"server-error"}))
			}
			
		}catch{
			response.send(JSON.stringify({"status":"server-error"}))
		}
		
	})
	
	const captureOrder = async (orderID) =>{
	
		const accessToken = await generateAccessToken();
		const base = "https://api-m.paypal.com";
		
		const url = `${base}/v2/checkout/orders/${orderID}/capture`;
		
		
		const response = await fetch(url,{
		
			method: "POST",
		
			headers:
		
			{
		
			"Content-Type": "application/json",
		
			Authorization: `Bearer ${accessToken}`,
		
			// Uncomment one of these to force an error for negative testing (in sandbox mode only). Documentation:
		
			// https://developer.paypal.com/tools/sandbox/negative-testing/request-headers/
		
			// "PayPal-Mock-Response": '{"mock_application_codes": "INSTRUMENT_DECLINED"}'
		
			// "PayPal-Mock-Response": '{"mock_application_codes": "TRANSACTION_REFUSED"}'
		
			// "PayPal-Mock-Response": '{"mock_application_codes": "INTERNAL_SERVER_ERROR"}'
		
			},
		
		});
		
		
		return await response.json();
	
	};
	
	
	async function handleResponse(response){
	
		try{
		
			const jsonResponse = await response.json();
		
			return {
		
			jsonResponse,
		
			httpStatusCode: response.status,
		
			};
		
		}catch (err){
		
			const errorMessage = await response.text();
		
			throw new Error(errorMessage);
		
		}
	
	}
	
	app.post("/api/orders/capture", async(request,response)=>{
		
		try{
			
			const orderID  = request.body.orderID;
			
			console.log(orderID)
			
			const process = await captureOrder(orderID);
			
			console.log(process)
			
			response.send(JSON.stringify({"status":process.status}));
			
		}catch (error){
			
			console.error("Failed to create order:", error);
			
			response.status(500).json(
			
			{
			
			error: "Failed to capture order."
			
			});
			
		}
		
		
	})
	
	async function GetTopSellers(users){
	    let output = []
	    
	    try{
	        
	        let getAdminDataController = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"admin-data-controller"})
	        let adminData = getAdminDataController.body 
	        let approvedSales = adminData.approvedSales
	        
	        let collection = []
	        
	        for(var i=0; i<approvedSales.length;i++){
	            let sale = approvedSales[i]
	            let seller = sale.seller 
	            let search = collection.find((collection)=>{
	                return collection.id === seller.id
	            })
	            if(!search){
	                collection.push({
	                    "id":seller.id,
	                    "user":seller,
	                    "hits":1
	                })
	            }else{
	                search.hits = search.hits + 1
	            }
	        }
	        
	        collection.sorted((a,b)=>{
	            b.hits-a.hits
	        })
	        
	        for(var i=0;i<collection.length;i++){
	            let x = collection[i]
	            output.push(x.user)
	        }
	    }catch{
	        
	    }
	    
	    return output 
	}
	
	app.post("/get-top-sellers", async(request,response)=>{
	    try{
	        let data = request.body 
	        let accessorId = data.accessorId
	        let socketCheck = await checkIfSocketActive(accessorId)
	        if(socketCheck == true){
	            
	            let getUsers = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-profiles"})
	            let users = getUsers.body 
	            let process = await GetTopSellers(users)
	            response.send(JSON.stringify({"status":"success","data":process}))
	            
	        }else{
	            response.send(JSON.stringify({"status":"server-error"}))
	        }
	    }catch{
	        response.send(JSON.stringify({"status":"server-error"}))
	    }
	})
	
	//GET TOP ITEMS FOR ADS
	
	async function GetTopItemsx(accessorId){
	    let output;
	    try{
	        output = []
	        let getViewTrack = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-views-track"})
	        let viewsTrack = getViewTrack.body 
	        
	        /*
	        *get top 3 items from top 3 categories most viewed by user 
	        */
	        
	        let userViewTrack = viewsTrack.find((viewsTrack)=>{
	            return viewsTrack.userId === accessorId
	        })
	        
	        //get categories most viewed by user 
	        
	        let collection = []
	        
	        let userLogs = userViewTrack.userLogs
	        
	        let currentLog = null 
	        
	        for(var i=0;i<userLogs.length;i++){
	            let log = userLogs[i]
	            if(
	                log.in.date == serverTime.date &&
	                log.in.month == serverTime.month &&
	                log.in.year == serverTime.year 
	            ){
	                currentLog = log
	            }
	            
	            let postsViewed = log.postsViewed
	            for(var x=0;x<postsViewed.length;x++){
	                let post = postsViewed[x]
	                let category = post.category
	                let search = collection.find((collection)=>{
	                    return collection.category === category
	                })
	                if(search){
	                    search.hits = search.hits+1
	                }else{
	                    collection.push({
	                        "category":category,
	                        "hits":1
	                    })
	                }
	            }
	        }
	        
	        //sort collection for hits 
	        
	        collection.sorted((a,b)=>{
	            b.hits-a.hits
	        })
	        
	        let categories = []
	        //get top three categories
	        categories.push(collection[0].category)
	        categories.push(collection[1].category)
	        categories.push(collection[2].category)
	        
	        //get catalogue 
	        let getCatalogue = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-items"})
	        let catalogue = getCatalogue.body 
	        
	        let collectionOne = []
	        let collectionTwo = []
	        let collectionThree = []
	        
	        for(var i=0; i<categories.length;i++){
	            let cat = categories[i]
	            for(var x=0;x<catalogue.length;x++){
	                let target = catalogue[x]
	                if(i == 0){
    	                if(target.category === cat){
    	                    collectionOne.push(target)
    	                }
	                }
	                if(i == 1){
    	                if(target.category === cat){
    	                    collectionTwo.push(target)
    	                }
	                }
	                if(i == 2){
    	                if(target.category === cat){
    	                    collectionThree.push(target)
    	                }
	                }
	            }
	            
	        }
	        
	        collectionOne.sorted((a,b)=>{
	            b.numberOfViews-a.numberOfViews
	        })
	        
	        collectionTwo.sorted((a,b)=>{
	            b.numberOfViews-a.numberOfViews
	        })
	        
	        collectionThree.sorted((a,b)=>{
	            b.numberOfViews-a.numberOfViews
	        })
			
			for(var i=0; i<collectionOne.length;i++){
				if(i <= 9){
					let post = collectionOne[i]
					let array = currentLog.postsViewed
					let search = array.find((array)=>{
						return array.id === post.id
					})
					if(!search){
						output.push(post)
						break
					}
				}
			}
			for(var i=0; i<collectionTwo.length;i++){
				if(i <= 9){
					let post = collectionTwo[i]
					let array = currentLog.postsViewed
					let search = array.find((array)=>{
						return array.id === post.id
					})
					if(!search){
						output.push(post)
						break
					}
				}
			}
			for(var i=0; i<collectionThree.length;i++){
				if(i <= 9){
					let post = collectionThree[i]
					let array = currentLog.postsViewed
					let search = array.find((array)=>{
						return array.id === post.id
					})
					if(!search){
						output.push(post)
						break
					}
				}
			}
	        
	        
	        
	    }catch{
	        output = null
	    }
	    return output
	}
	
	app.post("/get-current-top-items", async(request,response)=>{
	    try{
	        let data = request.body 
	        let accessorId = data.accessorId 
	        let socketCheck = await checkIfSocketActive(accessorId)
	        if(socketCheck == true){
	            let process = await GetTopItemsx(accessorId)
	            response.send(JSON.stringify({"status":"success","data":process}))
	        }else{
	            response.send(JSON.stringify({"status":"server-error"}))
	        }
	    }catch{
	        response.send(JSON.stringify({"status":"server-error"}))
	    }
	})
	
	async function openUserAccount(userId){
	    let output = false
	    try{
	        
	        let getUsers = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-profiles"})
	        let getCatalogue = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-items"})
	        let users = getUsers.body 
	        let catalogue = getCatalogue.body 
	        let user = users.find((users)=>{
	            return users.id === userId
	        })
	        if(user){
	            user.accountStatus = "Active"
	            for(var i=0;i<catalogue.length; i++){
	                let item = catalogue[i]
	                if(item.sellerId === userId){
	                    catalogue[i].coverage = true
	                }
	            }
	            await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-profiles"},{$set:{"body":users}})
	            await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-items"},{$set:{"body":catalogue}})
	            
	            output = true
	        }
	        
	    }catch{
	        output = false
	    }
	    return output
	}
	
	app.post("/re-instate-user", async(request,response)=>{
	    try{
	        let data = request.body 
	        let accessorId = data.accessorId 
	        let userId = data.userId 
	        let socketCheck = await checkIfSocketActive(accessorId)
	        if(socketCheck == true){
	            
	            let process = await openUserAccount(userId)
	            if(process == true){
	                response.send(JSON.stringify({"status":"success"}))
	            }else{
	                response.send(JSON.stringify({"status":"server-error"}))
	            }
	            
	        }else{
	            response.send(JSON.stringify({"status":"server-error"}))
	        }
	    }catch{
	        response.send(JSON.stringify({"status":"server-error"}))
	    }
	})
	
	app.post("/check-item-availability", async(request,response)=>{
	    try{
	        
	        let data = request.body 
	        let accessorId = data.accessorId 
	        let item = data.item 
	        let socketCheck = await checkIfSocketActive(accessorId)
	        
	        if(socketCheck == true){
	            
	            let getCatalogue = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-items"})
	            let catalogue = getCatalogue.body 
	            let itemFound = catalogue.find((catalogue)=>{
	                return catalogue.id === item.id
	            })
	            if(itemFound){
	                
	                if(item.coverage == true && item.quantityAvailable > 0){
	                    response.send(JSON.stringify({"status":"success"}))
	                }else{
	                    response.send(JSON.stringify({"status":"server-error"}))
	                }
	                
	            }else{
	                response.send(JSON.stringify({"status":"server-error"}))
	            }
	        }else{
	            response.send(JSON.stringify({"status":"server-error"}))
	        }
	        
	    }catch{
	        response.send(JSON.stringify({"status":"server-error"}))
	    }
	})
	
	async function NullifyUserSales(userId){
		let output;
		try{
			let getUsers = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"user-profiles"})
			let users = getUsers.body 
			
			for(var i=0; i<users.length; i++){
				let user = users[i]
				let transactions = user.transactions 
				for(var x=0; x<transactions.length;x++){
					let transaction = transactions[x]
					let seller = transaction.seller 
					if(seller.id === userId){
						users[i].transactions[x].status = "Cancelled"
					}
				}
			}
			
			await mongoClient.db("ZedMoney").collection("MainData").updateOne({"name":"user-profiles"},{$set:{"body":users}})
			
		}catch{
			output = false
		}
	}
	
	app.post("/nullify-user-sales",async(request,response)=>{
		try{
			
			let data = request.body 
			let accessorId = data.accessorId 
			let userId = data.userId 
			
			let socketCheck = await checkIfSocketActive(accessorId)
			
			if(socketCheck == true){
				
				let socket = await getUserSocket(accessorId)
				let x = socket["null-user-id"]
				if(x === userId){
					let process = await NullifyUserSales(userId)
					if(process == true){
						response.send(JSON.stringify({"status":"success"}))
					}else{
						response.send(JSON.stringify({"status":"server-error"}))
					}
				}
				
			}
			
		}catch{
			response.send(JSON.stringify({"status":"server-error"}))
		}
	})


async function GetTransPerformance(limitDate,inx){
    let output = null
    try{
        let getAdminData = await mongoClient.db("ZedMoney").collection("MainData").findOne({"name":"admin-data-controller"})
        let adminData = getAdminData.body 
        let transactionSales = adminData.transactionSales
        let approvedSales = adminData.approvedSales 
        
        output = {
            "week 1":0.0,
            "week 2":0.0,
            "week 3":0.0,
            "week 4":0.0,
        }
        
        if(inx == true){
            let income = transactionSales
			let collection = []
			for(var i=0; i <income.length;i++){
				let sale = income[i]
				let date = sale.date
				if(date.year == limitDate.year){
					if(date.month == limitDate.month){
						if(date.date <= limitDate.date){
							collection.push(sale)
						}
					}else{
						if(date.month < limitDate.month){
							collection.push(sale)
						}
					}
				}
			}
			
			//tray
			let weekOne = []
			let weekTwo = []
			let weekThree = []
			let weekFour = []
			
			//load trays
			for(var i=0; i<collection.length;i++){
				let sale = collection[i]
				let date = sale.date
				if(date.date >0 && date.date<=7){
					weekOne.push(sale.value)
				}
				if(date.date >7 && date.date<15){
					weekTwo.push(sale.value)
				}
				if(date.date >14 && date.date<22){
					weekThree.push(sale.value)
				}
				if(date.date >21 && date.date<29){
					weekFour.push(sale.value)
				}
				if(date.date >28 && date.date<32){
					weekFour.push(sale.value)
				}
			}
			
			for(var i=0; i < 4; i++){
				if(i == 0){
					var total = 0.0
					for(var x=0;x<weekOne.length;x++){
						let value = weekOne[x].amountProcessed
						total = total+value
					}
					output["week 1"] = Math.floor(total/weekOne.length)
				}
				if(i == 1){
					var total = 0.0
					for(var x=0;x<weekTwo.length;x++){
						let value = weekTwo[x].amountProcessed
						total = total+value
					}
					output["week 2"] = Math.floor(total/weekOne.length)
				}
				if(i == 2){
					var total = 0.0
					for(var x=0;x<weekThree.length;x++){
						let value = weekThree[x].amountProcessed
						total = total+value
					}
					output["week 3"] = Math.floor(total/weekOne.length)
				}
				if(i == 3){
					var total = 0.0
					for(var x=0;x<weekFour.length;x++){
						let value = weekFour[x].amountProcessed
						total = total+value
					}
					output["week 4"] = Math.floor(total/weekOne.length)
				}
				i = i+1
			}
        }else{
            let outCash = approvedSales
			let collection = []
			for(var i=0; i <outCash.length;i++){
				let sale = outCash[i]
				let date = sale.date
				if(sale.markAsSent == true){					
					if(date.year == limitDate.year){
						if(date.month == limitDate.month){
							if(date.date <= limitDate.date){
								collection.push(sale)
							}
						}else{
							if(date.month < limitDate.month){
								collection.push(sale)
							}
						}
					}
				}
			}
			//tray
			let weekOne = []
			let weekTwo = []
			let weekThree = []
			let weekFour = []
			
			//load trays
			for(var i=0; i<collection.length;i++){
				let sale = collection[i]
				let date = sale.date
				if(date.date >0 && date.date<=7){
					weekOne.push(sale.value)
				}
				if(date.date >7 && date.date<15){
					weekTwo.push(sale.value)
				}
				if(date.date >14 && date.date<22){
					weekThree.push(sale.value)
				}
				if(date.date >21 && date.date<29){
					weekFour.push(sale.value)
				}
				if(date.date >28 && date.date<32){
					weekFour.push(sale.value)
				}
			}
			
			for(var i=0; i < 4; i++){
				if(i == 0){
					var total = 0.0
					for(var x=0;x<weekOne.length;x++){
						let currency = weekOne[x].currency
						let value = weekOne[x].amountProcessed
						let map = weekOne[x].currencyMap
						if(currency == "ZMW"){							
							total = total+value
						}else{
							let convertValue = await convertValue("ZMW",currency,value,map)
							total = total+convertValue
						}
					}
					output["week 1"] = Math.floor(total/weekOne.length)
				}
				if(i == 1){
					for(var x=0;x<weekTwo.length;x++){
						let currency = weekTwo[x].currency
						let value = weekTwo[x].amountProcessed
						let map = weekTwo[x].currencyMap
						if(currency == "ZMW"){							
							total = total+value
						}else{
							let convertValue = await convertValue("ZMW",currency,value,map)
							total = total+convertValue
						}
					}
					output["week 2"] = Math.floor(total/weekOne.length)
				}
				if(i == 2){
					for(var x=0;x<weekThree.length;x++){
						let currency = weekThree[x].currency
						let value = weekThree[x].amountProcessed
						let map = weekThree[x].currencyMap
						if(currency == "ZMW"){							
							total = total+value
						}else{
							let convertValue = await convertValue("ZMW",currency,value,map)
							total = total+convertValue
						}
					}
					output["week 3"] = Math.floor(total/weekOne.length)
				}
				if(i == 3){
					for(var x=0;x<weekFour.length;x++){
						let currency = weekFour[x].currency
						let value = weekFour[x].amountProcessed
						let map = weekFour[x].currencyMap
						if(currency == "ZMW"){							
							total = total+value
						}else{
							let convertValue = await convertValue("ZMW",currency,value,map)
							total = total+convertValue
						}
					}
					output["week 4"] = Math.floor(total/weekOne.length)
				}
				i = i+1
			}
        }
    }catch{
        output = false
    }
    return output
    
}

app.post("/get-transaction-performance",async(request,response)=>{
    try{
        
        let data = request.body 
        let accessorId = data.accessorId
        let limitDate = data.limitDate 
        let inx = data.inx
        let socketCheck = await checkIfSocketActive(accessorId)
        if(socketCheck == true){
            
            let process = await GetTransPerformance(limitDate,inx)
            if(
                process == false ||
                process == null
                ){
                response.send(JSON.stringify({"status":"success","data":process}))
            }else{
                response.send(JSON.stringify({"status":"server-error"}))
            }
        }else{
            response.sendStatus(404)
        }
        
    }catch{
        response.send(JSON.stringify({"status":"server-error"}))
    }
})

server.listen(port)