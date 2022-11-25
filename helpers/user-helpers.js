var db = require("../config/connection");

const bcrypt = require("bcrypt");
var collection = require("../config/collections");


var objectId = require("mongodb").ObjectId;

const Razorpay=require('razorpay');
const { stringify } = require("querystring");
const { ObjectID } = require("bson");
const { resolve } = require("path");

 const serviceID=process.env.TWILIO_SERVICE_ID 
const accountSid = process.env.TWILIO_ACCOUNT_SID
 const authToken =process.env.TWILIO_AUTH_TOKEN
 
 const client = require('twilio')(accountSid, authToken);
 

var instance = new Razorpay({
  key_id: process.env.KEY_ID,
  key_secret: process.env. KEY_SECRET
  
});

//  function generateOTP() {
//    // Declare a digits variable 
//   // which stores all digits
//    var digits = '0123456789';
//    let OTP = '';
//    for (let i = 0; i < 4; i++ ) {
//    OTP += digits[Math.floor(Math.random() * 10)];
//    }
//    return OTP;
//    }


   
module.exports = {



doSignup:(userData)=>{
 return new Promise(async (resolve, reject) => {
 userData.Password = await bcrypt.hash(userData.Password, 10);

client.verify.v2
.services(serviceID)
.verifications.create({ to: '+91'+userData.Number, channel: "sms" })
.then((verification) => console.log(verification.status));
resolve(userData)

    });
  },



verifyOtp: (userOtp,userData) =>{
  
  return new Promise(async (resolve, reject) => {
    
const check= await client.verify.services(serviceID)
.verificationChecks
.create({to: '+91'+userData.Number, code: userOtp}).catch(e => {
  console.log(e);
  res.status(500).send(e)
  reject()
})

console.log(check.status);

if(check.status ===  'approved'){
  db.get().collection(collection.USER_COLLECTIONS).insertOne(userData).then((data)=>{
    resolve(userData)
  })
}else{
  reject()
}
  });
},


//   doSignup:(userData)=>{
//     return new Promise(async (resolve, reject) => {
//       userData.Password = await bcrypt.hash(userData.Password, 10);
//       let otp=generateOTP()
//     let Otp=otp
//          client.messages 
//          .create({ 
//            body: Otp,  
//             messagingServiceSid: process.env.MESSAGING_SERVICE_SID,      
//             to: '91'+userData.Number 
//           }) 
//          .then(message => console.log(message.sid)) 
//          .done();
//          db.get().collection(collection.OTP_COLLECTION).insertOne({onetimepassword:Otp}).then(()=>{
//           resolve(userData)
//          })
       
//     });
//   },


// verifyOtp: (userOtp,userData) =>{
  
//   return new Promise(async (resolve, reject) => {
    
//     let checkotp = await db.get().collection(collection.OTP_COLLECTION).findOne({ onetimepassword: userOtp });

//     if (checkotp) {
//     console.log('checkotp und');
//       db.get().collection(collection.USER_COLLECTIONS).insertOne(userData).then(() => {
//          db.get().collection(collection.OTP_COLLECTION).deleteOne({onetimepassword: userOtp})
        
//         resolve(userData);
//       });
//     }else{
//       console.log('otp illa');
//     reject()
//     }

//   });
// },

    

  doLogin: (userData) => {
    return new Promise(async (resolve, reject) => {
      let loginStatus = false;
      let response = {};
      let user = await db.get().collection(collection.USER_COLLECTIONS).findOne({ Email: userData.Email });
      if (user) {
        console.log('user und');
        bcrypt.compare(userData.Password, user.Password).then((status) => {
          console.log(status);
          if (status) {
            console.log("login success");
            response.user = user;
            response.status = true;
            resolve(response);
          } else {
            console.log("login failed");
            resolve({ status: false });
          }
        });
      } else {
        console.log("login failed");
        resolve({ status: false });
      }
    });
  },


 addToCart: (proId, userId) => {
    let proObj = {
      item: objectId(proId),
      quantity: 1,
      
    };
    return new Promise(async (resolve, reject) => {
      
      //to remove wishlist when user add to cart
      let userWish=await db.get().collection(collection.WISHLIST_COLLECTIONS).findOne({user:objectId(userId)})
     if(userWish){
      db.get().collection(collection.WISHLIST_COLLECTIONS).updateOne({user:objectId(userId)},{
        $pull:{products:{item:objectId(proId)}}
      }).then(()=>{
        resolve()
      })
     }
     

      let userCart = await db.get().collection(collection.CART_COLLECTIONS).findOne({ user: objectId(userId)});
      if (userCart) {
     let proExist=userCart.products.findIndex(product=> product.item==proId)
       console.log(proExist);
       if(proExist != -1){
db.get().collection(collection.CART_COLLECTIONS)
.updateOne({user:objectId(userId),'products.item':objectId(proId)},
{
    $inc:{'products.$.quantity':1}
}
).then(()=>{
  resolve()
})

       }else{
    db.get().collection(collection.CART_COLLECTIONS)
          .updateOne(
            { user: objectId(userId) },
            {
              $push: { products:proObj},
            }
          )
          .then((response) => {
            resolve();
          });}

      } else {
        let cartObj = {
          user: objectId(userId),
          products: [proObj]
        }

        db.get().collection(collection.CART_COLLECTIONS) .insertOne(cartObj).then((response) => {
            resolve();
          });
      }
    });
  },


  getCartProducts: (userId) => {
    return new Promise(async (resolve, reject) => {
      let cartItems = await db
        .get()
        .collection(collection.CART_COLLECTIONS)
        .aggregate([
          {
            $match: { user: objectId(userId) },
          },{
            $unwind:'$products'
          },{
            $project:{
              item:'$products.item',
              quantity:'$products.quantity'
            }
          },{
            $lookup:{
              from:collection.PRODUCT_COLLECTIONS,
              localField:'item',
              foreignField:'_id',
              as:'product'
            }
            },{
              $project:{
                item:1,
                quantity:1,
                product:{$arrayElemAt:['$product',0]}
              }
            }
          

          
        ]).toArray();
       
      resolve(cartItems);
    });
  },
  
  getCartCount: (userId) => {
    let count = 0;

    return new Promise(async (resolve, reject) => {
      let cart = await db
        .get()
        .collection(collection.CART_COLLECTIONS)
        .findOne({ user: objectId(userId) });

      if (cart) {
        count = cart.products.length;
      }
      resolve(count);
    });
  },

changeProductQuantity:(details)=>{
  details.count=parseInt(details.count)
  details.quantity=parseInt(details.quantity)

  return new Promise((resolve,reject)=>{

    if(details.count==-1 && details.quantity==1){

      db.get().collection(collection.CART_COLLECTIONS).updateOne({_id:objectId(details.cart)},
      {
        $pull:{products:{item:objectId(details.product)}}
      }).then((response)=>{
            resolve({removeProduct:true})
      })
    }else{
  
      db.get().collection(collection.CART_COLLECTIONS).updateOne({_id:objectId(details.cart),'products.item':objectId(details.product)},
      {
        $inc:{'products.$.quantity':details.count}
      }
      ).then((response)=>{
        resolve({status:true})
      })
    }
  })
},


removeCart:(details)=>{
return new Promise((resolve,reject)=>{
  db.get().collection(collection.CART_COLLECTIONS).updateOne({_id:objectId(details.cart)},
  
  {
    $pull:{products:{item:objectId(details.product)}}
  }
  ).then(()=>{
    resolve()
  })
})
},

getTotalAmount:(userId)=>{
  console.log(userId);
 
  return new Promise(async (resolve, reject) => {
    
    let total= await db.get().collection(collection.CART_COLLECTIONS)
      .aggregate([
        {
          $match: { user: objectId(userId)},
        },{
          $unwind:'$products'
        },{
          $project:{
            item:'$products.item',
            quantity:'$products.quantity'
            
          }
        },{
          $lookup:{
            from:collection.PRODUCT_COLLECTIONS,
            localField:'item',
            foreignField:'_id',
            as:'product'
          }
          },{
            $project:{
              item:1,

              quantity:1,
              product:{$arrayElemAt:['$product',0]}
            }
          },
          {
            $group:{
              _id:null,
              total:{$sum:{$multiply: ['$quantity', {$toInt: '$product.Price'}]}}
              
            }
          }
      ]).toArray();

      if (total[0]) { 
        console.log(total[0].total); 
       resolve(total[0].total);
       } else { console.log('total zero'); 
       resolve(0) } 
    
     
    
  });
},

placeOrder:(orderDetails,products,totalPrice)=>{
  console.log('ethy');
return new Promise((resolve,reject)=>{
  let orderStatus=orderDetails['payment-method']==='COD'?'placed':'pending'
  
  let orderObj={
    deliveryDetails:{
      mobile:orderDetails.mobile,
      pincode:orderDetails.pincode,
      address:orderDetails.address
    },
    name:orderDetails.name,
    userId:objectId(orderDetails.userId),
    paymentMethod:orderDetails['payment-method'],
    products:products,
    totalPrice:totalPrice,
    status:orderStatus,
    date: new Date().toLocaleString('en-IN',{
      day: 'numeric', // numeric, 2-digit
      year: 'numeric', // numeric, 2-digit
      month: 'numeric', // numeric, 2-digit,short, narrow
      hour: 'numeric', // numeric, 2-digit
      minute: 'numeric', // numeric, 2-digit
      //second: 'numeric', // numeric, 2-digit
    })
     
   
   
  }

  db.get().collection(collection.ORDER_COLLECTIONS).insertOne(orderObj).then((response)=>{
    db.get().collection(collection.CART_COLLECTIONS).deleteOne({user:objectId(orderDetails.userId)})
resolve(response.insertedId)
  })
})
},

getCartProductList:(userId)=>{
return new Promise(async(resolve,reject)=>{
  let cart=await db.get().collection(collection.CART_COLLECTIONS).findOne({user:objectId(userId)})
resolve(cart.products)

})
},

viewOrderDetails:(userId)=>{
console.log('id is '+userId);
return new Promise(async(resolve,reject)=>{
  let orderDetails=await db.get().collection(collection.ORDER_COLLECTIONS).find({userId:objectId(userId)}).sort({'date':-1}).toArray()
 
 // console.log(orderDetails);
  resolve(orderDetails)
  
})
},

orderedProduct:(orderId)=>{
 // console.log('order is '+orderId);
  return new Promise(async(resolve,reject)=>{
    let orderProItems=await db.get().collection(collection.ORDER_COLLECTIONS).aggregate([
      {
        $match: { _id: objectId(orderId) },
      },{
        $unwind:'$products'
      },{
        $project:{
          item:'$products.item',
          quantity:'$products.quantity'
        }
      },{
        $lookup:{
          from:collection.PRODUCT_COLLECTIONS,
          localField:'item',
          foreignField:'_id',
          as:'product'
        }
        },{
          $project:{
            item:1,
            quantity:1,
            product:{$arrayElemAt:['$product',0]}
          }
        }
      
    ]).toArray();
   
  resolve(orderProItems);

  })
},

generateRazorpay:(orderId,total)=>{
  return new Promise((resolve,reject)=>{
 
  var options={
  amount: total*100,
  currency: "INR",
  receipt: ""+orderId
 };
instance.orders.create(options, function(err,order){
  if(err){
    console.log(err);
  }else{
    console.log('new order:',order);
    resolve(order)
  }
})
  })
},

verifyPayment:(details)=>{
 return new Promise((resolve,reject)=>{
  const crypto=require('crypto')
  let hmac=crypto.createHmac('sha256', process.env.KEY_SECRET);
  hmac.update(details['payment[razorpay_order_id]']+'|'+details['payment[razorpay_payment_id]'])
  hmac=hmac.digest('hex')
  if(hmac==details['payment[razorpay_signature]']){
    resolve()
  }else{
    reject()
  }
 })
},

changePaymentStatus:(orderId)=>{
  return new Promise((resolve,reject)=>{
    db.get().collection(collection.ORDER_COLLECTIONS)
    .updateOne({_id:objectId(orderId)},
    {
      $set:{
        status:'placed'
      }
    }
    ).then(()=>{
      resolve()
    })
   
  })
},

getRequiredProducts: (category) => {
  console.log('pro edukkan ponu');
  console.log(category);
  return new Promise(async (resolve, reject) => {
    console.log("cat :"+category);
      let products = await db.get().collection(collection.PRODUCT_COLLECTIONS).find( { Category:category}).toArray()
      console.log(products);
      resolve(products)
      console.log('pro kitty');
      console.log(products);
  })
},

getUserProfile:(userId)=>{
  console.log(userId);
  return new Promise(async(resolve,reject)=>{
  let userProfile= await  db.get().collection(collection.USER_COLLECTIONS).findOne({_id:objectId(userId)})
     
   console.log(userProfile);
   resolve(userProfile)
  })
},


updateProfile:(userDetails,userId)=>{
  console.log(userId);
  return new Promise((resolve,reject)=>{
    db.get().collection(collection.USER_COLLECTIONS).updateOne({_id:objectId(userId)},
    {
      $set:{
        Name:userDetails.Name,
        Email:userDetails.Email,
        Number:userDetails.Number
      }
    }
    ).then((response)=>{
      resolve()
    })
  })
},

updatePassword:(passDetails,userId)=>{
  return new Promise(async(resolve,reject)=>{
    passDetails.Password = await bcrypt.hash(passDetails.Password, 10);
    passDetails.newPassword=await bcrypt.hash(passDetails.newPassword,10)
   
   let user=await db.get().collection(collection.USER_COLLECTIONS).findOne({_id:objectId(userId)})
   if(user){
    bcrypt.compare(passDetails.Password, user.Password).then(()=>{
       db.get().collection(collection.USER_COLLECTIONS).updateOne({_id:objectId(userId)},
       {
        $set:{
          Password:passDetails.newPassword
        }
       }).then(()=>{
        resolve()
       })
    })
   }else{
    reject(err)
   }

  })
},

userMessage:(userMsg)=>{
return new Promise((resolve,reject)=>{
  db.get().collection(collection.USER_MESSAGES).insertOne(userMsg).then(()=>{
    resolve()
  })
})
},


addWishList:(proId,userId)=>{

  let wishPro={
   item: objectId(proId),
   quantity: 1
  }
  return new Promise(async (resolve, reject) => {
    let userWish = await db.get().collection(collection.WISHLIST_COLLECTIONS).findOne({ user: objectId(userId)});
    if (userWish) {
   let proExist=userWish.products.findIndex(product=> product.item==proId)
    
     if(proExist != -1){
db.get().collection(collection.WISHLIST_COLLECTIONS)
.updateOne({user:objectId(userId),'products.item':objectId(proId)},
{
  $inc:{'products.$.quantity':1}
}
).then(()=>{
resolve()
})

     }else{
  db.get().collection(collection.WISHLIST_COLLECTIONS)
        .updateOne(
          { user: objectId(userId) },
          {
            $push: { products:wishPro},
          }
        )
        .then((response) => {
          resolve();
        });}

    } else {
      let wishObj = {
        user: objectId(userId),
        products: [wishPro]
      }

      db.get().collection(collection.WISHLIST_COLLECTIONS) .insertOne(wishObj).then((response) => {
          resolve();
        });
    }
  });
  },



  getWishProducts: (userId) => {
    return new Promise(async (resolve, reject) => {
      let WishItems = await db.get().collection(collection.WISHLIST_COLLECTIONS)
        .aggregate([
          {
            $match: { user: objectId(userId) },
          },{
            $unwind:'$products'
          },{
            $project:{
              item:'$products.item'
             
            }
          },{
            $lookup:{
              from:collection.PRODUCT_COLLECTIONS,
              localField:'item',
              foreignField:'_id',
              as:'product'
            }
            },{
              $project:{
                item:1,
                
                product:{$arrayElemAt:['$product',0]}
              }
            }
          

          
        ]).toArray();
       
      resolve(WishItems);
    });
  },


 
  getWishCount: (userId) => {
    let count = 0;

    return new Promise(async (resolve, reject) => {
      let wishlist = await db
        .get()
        .collection(collection.WISHLIST_COLLECTIONS)
        .findOne({ user: objectId(userId) });

      if (wishlist) {
        count = wishlist.products.length;
      }
      resolve(count);
    });
  },

  removeWish:(details)=>{
    return new Promise((resolve,reject)=>{
      db.get().collection(collection.WISHLIST_COLLECTIONS).updateOne({_id:objectId(details.wish)},{
        $pull:{products:{item:objectId(details.product)}}
      }
      ).then(()=>{
        resolve()
      })
      })
    
  },

  cancelOrder:(orderId)=>{
   return new Promise((resolve,reject)=>{
    db.get().collection(collection.ORDER_COLLECTIONS).deleteOne({_id:objectId(orderId)}).then((res)=>{
      resolve(res)
    })
   })

  },

  generateInvoice:(orderId)=>{
    return new Promise(async(resolve,reject)=>{
   console.log(orderId);
 let orderDetails=await db.get().collection(collection.ORDER_COLLECTIONS).findOne({_id:objectId(orderId)})
resolve(orderDetails)
 
    })
  }

  


















}