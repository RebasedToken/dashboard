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
] = Array.from(document.querySelectorAll(".col"))

const rebaseButton = rebaseButtonContainer.querySelector("button")

const contracts = {}
let address
let supply
let price

load()

async function load() {
  registerWeb3()
  await Promise.all(
    Object.entries(config).map(function ([name, address]) {
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
  if (!window.ethereum) {
    return sl("error", "Please install Metamask browser extension.")
  }
  await ethereum.request({method: "eth_requestAccounts"})
  await loadAccount()
}

async function loadAccount() {
  if (window.ethereum) {
    networkLabel.innerText = await window.WEB3.eth.net.getNetworkType()

    const [addr] = await WEB3.eth.getAccounts();
    setAddress(addr)
  } else {
    setAddress()
  }
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
  loadCooldownStats()
  await Promise.all([loadReb2Price(), loadReb2Supply()])
  loadReb2MarketCap()
}

async function loadCooldownStats() {
  const cooldownExpiryTimestamp = await contracts.rebasedController.read(
    "cooldownExpiryTimestamp",
    []
  )
  setInterval(function () {
    const ms = Date.now() - 1000 * cooldownExpiryTimestamp
    const duration = toHumanizedDuration(ms)
    rebaseCooldownContainer.querySelectorAll("div")[1].innerText = duration
    if (ms < 0) {
      rebaseButton.setAttribute("disabled", "disabled")
    } else {
      rebaseButton.removeAttribute("disabled")
    }
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
    Web3.utils.fromWei(await contracts.rebasedV2.read("totalSupply", []), "wei")
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
  await Swal.fire({
    confirmButtonText: "Rebase",
    html:
      '<input data-name="epoch" class="rebase-input swal2-input" placeholder="Enter epoch...">' +
      '<input data-name="supply delta" class="rebase-input swal2-input" placeholder="Enter supply delta...">',
    showLoaderOnConfirm: true,
    preConfirm: async function () {
      const vals = []
      const inputs = Array.from(document.querySelectorAll(".rebase-input"))

      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i]
        const val = parseInt(input.value || "")
        if (!val)
          return Swal.showValidationMessage(
            input.dataset.name + " is required/invalid."
          )
        vals.push(val)
      }

      try {
        await waitForTxn(await contracts.rebasedV2.write("rebase", vals), [])
      } catch (e) {
        return Swal.showValidationMessage(e.message)
      }
      sl("info", "Done!")
    },
    didOpen: function () {
      document.querySelector(".rebase-input").focus()
    },
    showCancelButton: true,
  })
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
    {label: "w", mod: 7},
  ]
  units.forEach(function (u) {
    ms = (ms - (dur[u.label] = ms % u.mod)) / u.mod
  })
  return units
    .reverse()
    .filter(function (u) {
      return u.label !== "ms" && dur[u.label]
    })
    .map(function (u) {
      return dur[u.label] + u.label
    })
    .join(":")
}

async function sleep(ms) {
  return await new Promise(function (resolve) {
    return setTimeout(resolve, ms)
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
