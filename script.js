const rootContainer = document.getElementById("root-container")
const loaderContainer = document.getElementById("loader-container")

const connectButtonContainer = document.getElementById(
  "connect-button-container"
)
const connectButton = connectButtonContainer.querySelector("button")

const networkLabel = document.getElementById("network-label")
const addressLabel = document.getElementById("address-label")

const [
  rebaseCooldownContainer,
  reb2PriceContainer,
  reb2SupplyContainer,
  rebaseButtonContainer,
  priceTargetContainer,
  reb2MarketCapContainer,
] = document.querySelectorAll(".col")

const rebaseButton = rebaseButtonContainer.querySelector("button")

const contracts = {}
let address
let supply
let price
let cooldownTimer
let chartData

window.onload = load

async function load() {
  registerWeb3()
  await Promise.all(
    Object.entries(CONTRACTS).map(function ([name, address]) {
      const contract = (contracts[name] = new Contract())
      return contract.setContract(name, address)
    })
  )
  connectButton.addEventListener("click", function () {
    connectWeb3()
  })
  rebaseButton.addEventListener("click", function () {
    rebase()
  })
  await loadAccount()
}

async function connectWeb3() {
  await requireWeb3()
  await ethereum.request({method: "eth_requestAccounts"})
  await loadAccount()
}

async function loadAccount() {
  const network = (networkLabel.innerText = await window.WEB3.eth.net.getNetworkType())
  if (network !== "main") {
    completeBootLoader()
    return sl("error", "Please switch to mainnet")
  }

  const [addr] = await WEB3.eth.getAccounts()
  setAddress(addr)

  completeBootLoader()
  loadStats()
}

async function setAddress(addr) {
  address = addr
  if (address) {
    addressLabel.innerText = `${address.substring(0, 6)}...${address.substring(
      address.length - 4,
      address.length
    )}`

    for (const contractName in contracts) {
      contracts[contractName].setAccount(address)
    }
  }
  toggle(connectButtonContainer, !address)
}

async function loadStats() {
  setupCharts()
  loadCooldownStats()
  await Promise.all([loadReb2Price(), loadReb2Supply()])
  loadReb2MarketCap()
}

async function loadCooldownStats() {
  const cooldownExpiryTimestamp = await contracts.rebasedController.read(
    "cooldownExpiryTimestamp",
    []
  )
  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownTimer = setInterval(function () {
    const ms = 1000 * cooldownExpiryTimestamp - Date.now()
    let duration
    if (ms < 0) {
      duration = "0d:0h:0m:0s"
      rebaseButton.removeAttribute("disabled")
    } else {
      duration = toHumanizedDuration(ms)
      rebaseButton.setAttribute("disabled", "disabled")
    }
    rebaseCooldownContainer.querySelectorAll("div")[1].innerText = duration
  })
}

async function loadReb2Price() {
  price = parseFloat(
    Web3.utils.fromWei(
      await contracts.rebasedOracle.read("getData", []),
      "ether"
    )
  )
  reb2PriceContainer.querySelectorAll("div")[1].innerText =
    "$" + toHumanizedCurrency(price)
}

async function loadReb2Supply() {
  supply = parseFloat(
    Web3.utils.fromWei(
      await contracts.rebasedV2.read("totalSupply", []),
      "gwei"
    )
  )
  reb2SupplyContainer.querySelectorAll("div")[1].innerText = toHumanizedNumber(
    supply
  )
}

async function loadReb2MarketCap() {
  const mktCap = price * supply
  reb2MarketCapContainer.querySelectorAll("div")[1].innerText =
    "$" + toHumanizedCurrency(mktCap)
}

async function rebase() {
  await requireWeb3(true)
  try {
    await waitForTxn(await contracts.rebasedController.write("rebase"))
  } catch (e) {
    return sl("error", e)
  }
  sl("info", "Done!")
  loadCooldownStats()
}

async function setupCharts() {
  chartData = await xhr(
    "get",
    ~window.location.href.indexOf("local")
      ? "http://localhost:5000"
      : "http://199.192.22.187:5000"
  )
  loadPriceChart()
}

function loadPriceChart() {
  const data = chartData.price

  const container = document.getElementById("price-chart")
  const groups = container.querySelectorAll(".chart-toggle-buttons")
  const current = {
    type: "abs",
    duration: groups[0].querySelector("div").dataset.duration,
  }
  const {x} = data[current.duration]
  const y = data[current.duration][current.type]
  const config = {
    type: "line",
    data: {
      labels: x,
      datasets: [
        {
          label: "Price",
          backgroundColor: COLORS.lightred,
          borderColor: COLORS.lightred,
          fill: "start",
          data: y,
        },
      ],
    },
    options: {
      responsive: true,
      title: {
        display: false,
      },
      legend: {
        display: false,
      },
      scales: {
        xAxes: [
          {
            display: true,
          },
        ],
        yAxes: [
          {
            display: true,
            lineTension: 0.000001,
            ticks: {
              callback: function (value, index, values) {
                return current.type === "abs"
                  ? "$" +
                      toHumanizedCurrency(
                        Web3.utils.fromWei(value.toString(), "ether")
                      )
                  : value + "%"
              },
            },
          },
        ],
      },
      tooltips: {
        callbacks: {
          label: function (tooltipItem, data) {
            return current.type === "abs"
              ? "$" + toHumanizedCurrency(
                  Web3.utils.fromWei(tooltipItem.yLabel.toString(), "ether")
                )
              : tooltipItem.yLabel + "%"
          },
        },
      },
    },
  }

  const ctx = container.querySelector("canvas").getContext("2d")
  const chart = new Chart(ctx, config)

  groups.forEach(function (group, i) {
    const kind = group.dataset.kind
    const buttons = group.querySelectorAll("div")
    buttons.forEach((button) => {
      button.addEventListener("click", function () {
        buttons.forEach(function (b) {
          b.classList.toggle("active", b === button)
        })
        current[kind] = button.dataset[kind]
        updateChart()
      })
    })
  })

  function updateChart() {
    const {x} = data[current.duration]
    const y = data[current.duration][current.type]
    chart.data.labels = x
    chart.data.datasets[0].data = y
    chart.update()
  }
}

function show(el) {
  toggle(el, true)
}

function hide(el) {
  toggle(el, false)
}

function toggle(el, show) {
  el.classList[show ? "remove" : "add"]("hidden")
}

function enable(el) {
  attr(el, "disabled", false)
}

function disable(el) {
  attr(el, "disabled", "disabled")
}

function attr(el, attribute, val) {
  if (val) {
    el.setAttribute(attribute, val)
  } else {
    el.removeAttribute(attribute)
  }
}

async function requireWeb3(addr) {
  if (!window.ethereum) {
    const e = new Error("Please install Metamask browser extension.")
    sl("error", e)
    throw e
  }
  if (addr && !address) {
    const [addr] = await ethereum.request({method: "eth_requestAccounts"})
    setAddress(addr)
  }
}

function completeBootLoader() {
  document.documentElement.classList.remove("loading")
  loaderContainer.remove()
  show(rootContainer)
}

function toHumanizedNumber(val) {
  return val.toLocaleString("en-US", {maximumFractionDigits: 2})
}

function toHumanizedCurrency(val) {
  return new Intl.NumberFormat("en-US", {style: "currency", currency: "USD"})
    .format(val)
    .replace("$", "")
}

function toHumanizedDuration(ms) {
  const dur = {}
  const units = [
    {label: "ms", mod: 1000},
    {label: "s", mod: 60},
    {label: "m", mod: 60},
    {label: "h", mod: 24},
    {label: "d", mod: 31},
    // {label: "w", mod: 7},
  ]
  units.forEach(function (u) {
    ms = (ms - (dur[u.label] = ms % u.mod)) / u.mod
  })
  return units
    .reverse()
    .filter(function (u) {
      return u.label !== "ms" // && dur[u.label]
    })
    .map(function (u) {
      let val = dur[u.label]
      if (u.label === "m" || u.label === "s") {
        val = val.toString().padStart(2, "0")
      }
      return val + u.label
    })
    .join(":")
}

async function sleep(ms) {
  return await new Promise(function (resolve) {
    return setTimeout(resolve, ms)
  })
}

function sl(type, msg) {
  Swal.fire({
    icon: type,
    text: msg,
  })
}

async function xhr(method, endpoint, data) {
  NProgress.start()
  NProgress.set(0.4)

  try {
    const opts = {}
    if (data) {
      opts.method = method.toUpperCase()
      opts.body = JSON.stringify(data)
      opts.headers = {
        Accept: "application/json",
        "Content-Type": "application/json",
      }
    }
    const res = await fetch(endpoint, opts)
    return await res.json()
  } finally {
    NProgress.done()
  }
}
