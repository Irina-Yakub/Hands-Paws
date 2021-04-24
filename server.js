const express = require('express')
const mysql = require("mysql")
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { request } = require('express')

const app = express()
const port = 3000
const JWT_SECRET = 'dont26change28this30secret1value'
const year = 31_556_926

app.set("view engine", "ejs")
app.use(express.json({limit: '20mb'}))

app.use(express.static(__dirname + '/public'))

const con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "hands&paws",
})

app.get('/', async (req, res) => {
    const autologin = getAutologinFromCookie(req.headers.cookie)

    if (!autologin) {
        return res.sendFile(__dirname + '/public/HTML/main.html')
    }

    const email = jwt.verify(autologin, JWT_SECRET).email
    const account = await getAccountByEmail(email)

    if (account.type === 'user') {
        return res.sendFile(__dirname + '/public/HTML/main.html')
    }
    const requests = await getAllRequests(account.data.id)
    const usersCards = await getCardsWithUsersFromRefuge(account.data.id)
    const freeCards = await getCardsWithoutUsersFromRefuge(account.data.id)

    const renderData = {
        refuge: account.data, 
        requests: [],
        userscards: [],
        freecards: []
    }
    if (requests) {
        renderData.requests = requests.map(e => e = {
            pet: e.petname,
            user: {
                name: e.pib,
                phone: e.phone,
                email: e.email
            }
        })
    }    
    if (usersCards) {
        renderData.userscards = usersCards.map(e => e = {
            pet: {
                id: e.id,
                name: e.name,
                photo: e.photo
            },
            user: {
                name: e.pib,
                phone: e.phone,
                email: e.email
            }
        })
    }
    if (freeCards) {
        renderData.freecards = freeCards.map(e => e = {
            pet: {
                id: e.id,
                name: e.name,
                photo: e.photo
            }
        })
    }
    return res.render('refugehome', { ...renderData })
})
app.get('/helpus', (req, res) => { res.sendFile(__dirname + '/public/HTML/help_us.html') })
app.get('/faq', (req, res) => { res.sendFile(__dirname + '/public/HTML/faq.html') })
app.get('/reg', (req, res) => { res.sendFile(__dirname + '/public/HTML/reg.html') })
app.get('/login', (req, res) => { res.sendFile(__dirname + '/public/HTML/login.html') })
app.get('/sheltered', (req, res) => { res.sendFile(__dirname + '/public/HTML/sheltered.html') })
app.get('/added', (req, res) => { res.sendFile(__dirname + '/public/HTML/added.html') })
app.get('/add', async (req, res) => {
    const autologin = getAutologinFromCookie(req.headers.cookie)

    if (!autologin) {
        return res.redirect('/')
    }

    const email = jwt.verify(autologin, JWT_SECRET).email
    const account = await getAccountByEmail(email)

    if (account.type === 'user') {
        return res.redirect('/')
    }

    return res.sendFile(__dirname + '/public/HTML/pet_card.html')
})

app.get('/catalog', (req, res) => { 
    con.query(`SELECT pet.id, pet.name, pet.age, pet.photo, refuge.name AS refugename, refuge.address FROM pet, refuge WHERE refuge.id = pet.id_refuge AND pet.id_user IS NULL LIMIT 3`, function (err, result) {
        if (err) throw err
        let cards = []

        result.forEach(e => {
            cards.push({
                pet: {
                    id: e.id,
                    name: e.name,
                    age: e.age,
                    photo: e.photo
                },
                refuge: {
                    name: e.refugename,
                    address: e.address
                }
            })
        })
        res.render('catalog', {cards: cards}) 
    })
})

app.get('/api/pet', (req, res) => {
    con.query("SELECT *  FROM pet", function (err, result) {
        if (err) throw err
        res.header("Content-Type",'application/json')
        res.send(JSON.stringify(result, null, 4))
        res.end()
    })
})

app.get('/api/card', (req, res) => {
    con.query(`SELECT pet.id, pet.name, pet.age, pet.photo, refuge.name AS refugename, refuge.address FROM pet, refuge WHERE refuge.id = pet.id_refuge`, function (err, result) {
        if (err) throw err
        let cards = []

        result.forEach(e => {
            cards.push({
                pet: {
                    id: e.id,
                    name: e.name,
                    age: e.age,
                    photo: e.photo
                },
                refuge: {
                    name: e.refugename,
                    address: e.address
                }
            })
        })

        res.header("Content-Type",'application/json')
        res.send(JSON.stringify(cards, null, 4))
        res.end()
    })
})

app.get('/api/pet/:id', (req, res) => {
    const id = req.params.id
    con.query(`SELECT * FROM pet WHERE id = ${id}`, function (err, result) {
        if (err) throw err
        res.header("Content-Type",'application/json')
        res.send(JSON.stringify(result[0], null, 4))
        res.end()
    })
})

app.get('/api/card/:id', (req, res) => {
    const id = req.params.id
    con.query(`SELECT pet.id, pet.name, pet.age, pet.photo, refuge.name AS refugename, refuge.address FROM pet, refuge WHERE pet.id = ${id}`, function (err, result) {
        if (err) throw err
        if (result.length != 0) {
            const card = {
                pet: {
                    id: result[0].id,
                    name: result[0].name,
                    age: result[0].age,
                    photo: result[0].photo
                },
                refuge: {
                    name: result[0].refugename,
                    address: result[0].address
                }
            }

            res.header("Content-Type",'application/json')
            res.send(JSON.stringify(card, null, 4))
        }
        res.end()
    })
})

app.get('/pet/:id', (req, res) => {
    const id = req.params.id
    con.query(`SELECT pet.id, pet.name, pet.weight, pet.sex, pet.category, pet.age, pet.photo, pet.info, pet.id_user, refuge.name AS refugename, refuge.address FROM pet, refuge WHERE pet.id = ${id}`, async (err, result) => {
        if (err) throw err
        if (result.length == 0) {
            res.status(404).sendFile(__dirname + '/public/404/404.html')
            return
        }
        
        const card = {
            pet: {
                id: result[0].id,
                category: result[0].category,
                weight: result[0].weight,
                sex: result[0].sex,
                name: result[0].name,
                age: result[0].age,
                photo: result[0].photo,
                info: result[0].info,
                user: result[0].id_user
            },
            refuge: {
                name: result[0].refugename,
                address: result[0].address
            },
            user: 0
        }
        const autologin = getAutologinFromCookie(req.headers.cookie)

        if (autologin) {
            const email = jwt.verify(autologin, JWT_SECRET).email
            const account = await getAccountByEmail(email)

            if (account.type === 'user') {
                card.user = account.data.id
            }
        }

        return res.render('petid', card)
    })
})

app.post('/api/search', (req, res) => {
    const body = req.body
    
    let sql = "SELECT pet.id, pet.name, pet.age, pet.photo, refuge.name AS refugename, refuge.address FROM pet, refuge WHERE refuge.id = pet.id_refuge AND pet.id_user IS NULL"
    
    if (body.type.length != 0) {
        if (body.type.includes('else')) {
            if (!body.type.includes('dog')) {
                sql += " AND pet.category != 'Dog'"
            }
            if (!body.type.includes('cat')) {
                sql += " AND pet.category != 'Cat'"
            }
            if (!body.type.includes('rodent')) {
                sql += " AND pet.category != 'Rodent'"
            }
        } else {
            sql += ` AND pet.category IN('${body.type.join('\',\'')}')`
        }
    }

    if (body.sex.length == 1) {
        sql += ` AND pet.sex = '${body.sex}'`
    }

    if (body.country != 'selected') {
        sql += ` AND refuge.country = '${body.country}'`
    }

    if (body.refuge) {
        sql += ` AND refuge.name = '${body.refuge}'`
    }

    sql += " LIMIT 50"

    con.query(sql, (err, result) => {
        let cards = []


        result.forEach(e => {
            cards.push({
                pet: {
                    id: e.id,
                    name: e.name,
                    age: e.age,
                    photo: e.photo
                },
                refuge: {
                    name: e.refugename,
                    address: e.address
                }
            })
        })
        res.json(cards)
    })
})

app.post('/api/register/user', async (req, res) => {
    const { name, country, phone, email, password : plainTextPassword } = req.body
    
    try {
        const account = await getAccountByEmail(email)

        if (account) {
            return res.json({ status: 'exist' })
        }

        const password = await bcrypt.hash(plainTextPassword, 10)
        con.query(`INSERT INTO user (pib, country, phone, email, password) VALUES ('${name}','${country}','${phone}','${email}','${password}')`, async (err, result) => {
            if (err) throw err
            const autologin = jwt.sign({ email }, JWT_SECRET)

            return res.cookie('autologin', autologin, { 
                expires: new Date(Date.now() + year),
                httpOnly: true, 
                path: '/', 
                secure: true 
            }).send()
        })
    } catch (error) {
        console.error(error)
        return res.json({ status: 'err' })
    }
})

app.post('/api/register/refuge', async (req, res) => {
    const { name, country, address, email, password : plainTextPassword } = req.body
    
    try {
        const account = await getAccountByEmail(email)

        if (account) {
            return res.json({ status: 'exist' })
        }

        const password = await bcrypt.hash(plainTextPassword, 10)
            con.query(`INSERT INTO refuge (name, country, address, email, password) VALUES ('${name}','${country}','${address}','${email}','${password}')`, async (err, result) => {
            if (err) throw err
            const autologin = jwt.sign({ email }, JWT_SECRET)

            return res.cookie('autologin', autologin, { 
                expires: new Date(Date.now() + year),
                httpOnly: true, 
                path: '/', 
                secure: true 
            }).send()
        })
    } catch (error) {
        console.error(error)
        return res.json({ status: 'err' })
    }
})

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body

    try {
        const account = await getAccountByEmail(email)
        if (!account) {
            return res.json({ status: 'not exist' })
        }

        const autologin = jwt.sign({ email }, JWT_SECRET)

        if (await bcrypt.compare(password, account.data.password)) { 
            return res.cookie('autologin', autologin, { 
                expires: new Date(Date.now() + year),
                httpOnly: true, 
                path: '/', 
                secure: true 
            }).send()
        }

        return res.json({ status: 'wrong password' })

    } catch (error) {
        console.error(error)
        return res.json({ status: 'err' })
    }
})

app.post('/api/logout', (req, res) => {
    res.clearCookie('autologin', { path: '/' }).send()
})

app.post('/api/shelter', async (req, res) => {
    const autologin = getAutologinFromCookie(req.headers.cookie)

    if (!autologin) {
        return res.json({ redirect: '/login' })
    }

    const email = jwt.verify(autologin, JWT_SECRET).email
    const account = await getAccountByEmail(email)

    if (account.type === 'refuge') {
        return res.json({ status: 'permission denied' })
    }

    const { petid } = req.body

    con.query(`SELECT * FROM pet WHERE id = '${petid}'`, (err, result) => {
        if (err) throw err
        if (!result[0].id_user) {
            // pet has no user
            // con.query(`UPDATE pet SET id_user = '${account.data.id}' WHERE id = '${petid}'`)
            con.query(`INSERT INTO pet_requests (pet_id, user_id) VALUES ('${petid}', '${account.data.id}')`)
            return res.json({ redirect: '/sheltered' })
        }
    })
})

app.post('/api/add', async (req, res) => {
    const autologin = getAutologinFromCookie(req.headers.cookie)

    if (!autologin) {
        return res.json({ redirect: '/login' })
    }

    const email = jwt.verify(autologin, JWT_SECRET).email
    const account = await getAccountByEmail(email)

    if (account.type === 'user') {
        return res.json({ status: 'permission denied' })
    }

    const data = req.body
    
    con.query(`INSERT INTO pet (category, sex, name, photo, age, weight, info, id_refuge) 
    VALUES ('${data.type}', '${data.sex}', '${data.name}', '${data.photo}', '${data.age}', '${data.weight}', '${data.info}', '${account.data.id}')`)
    return res.json({ redirect: '/added' })
})

function getAutologinFromCookie(cookie) {
    const entries = new Map(
        cookie
        .split('; ')
        .map(e => e.split('='))
    )
    const cookies = Object.fromEntries(entries)
    return cookies['autologin']
}

function getAccountByEmail(email) {
    return new Promise(function(resolve, reject) {
        con.query(`SELECT * FROM user WHERE email = '${email}'`, async (err, user) => {
            if (user.length) {
                resolve ({
                    type: 'user',
                    data: user[0]
                })
            }
            con.query(`SELECT * FROM refuge WHERE email = '${email}'`, async (err, refuge) => {
                if (refuge.length) {
                    resolve ({
                        type: 'refuge',
                        data: refuge[0]
                    })
                }
                resolve (false)
            })
        })
    })
}

function getAllRequests(refuge_id) {
    return new Promise(function(resolve, reject) {
        con.query(`SELECT pet.name AS petname, user.pib, user.phone, user.email 
        FROM pet, user 
        WHERE pet.id IN (SELECT pet_id FROM pet_requests WHERE pet_id IN (SELECT id FROM pet WHERE pet.id_refuge = ${refuge_id})) 
        AND user.id IN (SELECT user_id FROM pet_requests WHERE pet_id IN (SELECT id FROM pet WHERE pet.id_refuge = ${refuge_id}))`, 
        async (err, requests) => {
            if (err) reject(err)
            if (requests.length) {
                resolve (requests)
            }
            resolve (false)
        })
    })
}

function getCardsWithUsersFromRefuge(refuge_id) {
    return new Promise(function(resolve, reject) {
        con.query(`SELECT pet.id, pet.photo, pet.name, user.pib, user.phone, user.email FROM pet, user WHERE pet.id_refuge = ${refuge_id} AND pet.id_user = user.id`, 
        async (err, result) => {
            if (err) reject(err)
            if (result.length) {
                resolve (result)
            }
            resolve (false)
        })
    })
}

function getCardsWithoutUsersFromRefuge(refuge_id) {
    return new Promise(function(resolve, reject) {
        con.query(`SELECT pet.id, pet.photo, pet.name FROM pet WHERE pet.id_refuge = ${refuge_id} AND ISNULL(pet.id_user)`, 
        async (err, result) => {
            if (err) reject(err)
            if (result.length) {
                resolve (result)
            }
            resolve (false)
        })
    })
}

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`)
})

app.get('*', function(req, res){
    res.status(404).sendFile(__dirname + '/public/404/404.html')
})
