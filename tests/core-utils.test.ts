import { expect } from "chai"
import {
  parseDuration,
  worldProgress,
  epochSecondsRemaining,
  calculateLevel,
  abbreviateAddress,
  lamportsToSol,
} from "../core/dist"
import { parseError } from "../core/dist"

describe("core/utils — funciones puras del SDK", () => {
  describe("parseDuration", () => {
    it("retorna el número tal cual si ya es segundos", () => {
      expect(parseDuration(3600)).to.equal(3600)
    })

    it("convierte strings de duración conocidos", () => {
      expect(parseDuration("1d")).to.equal(86400)
      expect(parseDuration("7d")).to.equal(604800)
      expect(parseDuration("24h")).to.equal(86400)
      expect(parseDuration("30m")).to.equal(1800)
      expect(parseDuration("30d")).to.equal(2592000)
    })

    it("lanza error claro con un string no reconocido", () => {
      expect(() => parseDuration("3 semanas")).to.throw(/Duración inválida/)
    })
  })

  describe("worldProgress", () => {
    it("calcula el porcentaje correctamente", () => {
      expect(worldProgress(50, 100)).to.equal(50)
      expect(worldProgress(0, 100)).to.equal(0)
      expect(worldProgress(100, 100)).to.equal(100)
    })

    it("nunca excede 100% aunque resourcesCollected supere el total", () => {
      expect(worldProgress(150, 100)).to.equal(100)
    })

    it("retorna 0 si totalResources es 0 (evita división por cero)", () => {
      expect(worldProgress(10, 0)).to.equal(0)
    })
  })

  describe("epochSecondsRemaining", () => {
    it("retorna -1 si epochDuration es 0 o negativo (sin límite de tiempo)", () => {
      expect(epochSecondsRemaining(Math.floor(Date.now() / 1000), 0)).to.equal(-1)
    })

    it("calcula segundos restantes correctamente", () => {
      const now = Math.floor(Date.now() / 1000)
      const startedAt = now - 100 // empezó hace 100s
      const epochDuration = 1000 // dura 1000s
      const remaining = epochSecondsRemaining(startedAt, epochDuration)
      // Debe quedar cerca de 900s restantes (con margen por el tiempo de ejecución del test)
      expect(remaining).to.be.closeTo(900, 5)
    })

    it("nunca retorna negativo — si ya expiró, retorna 0", () => {
      const now = Math.floor(Date.now() / 1000)
      const startedAt = now - 2000
      const epochDuration = 1000
      expect(epochSecondsRemaining(startedAt, epochDuration)).to.equal(0)
    })
  })

  describe("calculateLevel", () => {
    it("nivel 1 con 0 recursos", () => {
      expect(calculateLevel(0)).to.equal(1)
    })

    it("sube de nivel cada 10 recursos (threshold default)", () => {
      expect(calculateLevel(9)).to.equal(1)
      expect(calculateLevel(10)).to.equal(2)
      expect(calculateLevel(25)).to.equal(3)
    })

    it("respeta un threshold custom", () => {
      expect(calculateLevel(5, 5)).to.equal(2)
    })
  })

  describe("abbreviateAddress", () => {
    it("abrevia una dirección larga con el formato esperado", () => {
      const addr = "6byM2kmNLLGcrjRcq7ETVvGpxKgoEQuAof44SXe1vEee"
      expect(abbreviateAddress(addr)).to.equal("6byM...vEee")
    })

    it("respeta el parámetro de cantidad de caracteres", () => {
      const addr = "6byM2kmNLLGcrjRcq7ETVvGpxKgoEQuAof44SXe1vEee"
      const expected = addr.slice(0, 6) + "..." + addr.slice(-6)
      expect(abbreviateAddress(addr, 6)).to.equal(expected)
    })
  })

  describe("lamportsToSol", () => {
    it("convierte lamports a SOL correctamente", () => {
      expect(lamportsToSol(1_000_000_000)).to.equal("1.0000")
      expect(lamportsToSol(100_000_000)).to.equal("0.1000")
    })

    it("respeta la precisión de decimales solicitada", () => {
      expect(lamportsToSol(123_456_789, 2)).to.equal("0.12")
    })
  })

  describe("parseError", () => {
    it("reconoce el rechazo de wallet del usuario", () => {
      const err = new Error("User rejected the request")
      const parsed = parseError(err)
      expect(parsed.code).to.equal(-3)
      expect(parsed.message).to.include("rechazada")
    })

    it("reconoce fondos insuficientes", () => {
      const err = new Error("insufficient funds for transaction")
      const parsed = parseError(err)
      expect(parsed.code).to.equal(-2)
      expect(parsed.message).to.include("SOL insuficiente")
    })

    it("reconoce una cuenta que ya existe", () => {
      const err = new Error("Allocate: account already in use")
      const parsed = parseError(err)
      expect(parsed.code).to.equal(-5)
      expect(parsed.message).to.include("ya existe")
    })

    it("mapea un error code de Anchor conocido (CollectCooldown = 6003)", () => {
      const anchorErr = {
        error: { errorCode: { number: 6003 } },
        message: "raw anchor error",
      }
      const parsed = parseError(anchorErr)
      expect(parsed.code).to.equal(6003)
      expect(parsed.message).to.include("esperar")
    })

    it("no revienta con un input completamente desconocido", () => {
      const parsed = parseError({ weird: "shape" })
      expect(parsed.code).to.equal(-1)
      expect(parsed.message).to.be.a("string")
    })
  })
})
