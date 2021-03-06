import { useCall } from '@usedapp/core'
import { useContracts } from '../constants'

export const useRaffleView = (raffleId: number | undefined) => {
  const { RaffleParty } = useContracts()
  const { value, error } =
    useCall(
      typeof raffleId == 'number' && {
        contract: RaffleParty as any,
        method: 'getRaffleView', // Method to be called
        args: [raffleId], // Method arguments
      }
    ) ?? {}
  if (error) {
    console.error(error.message)
    return undefined
  }
  return (value ? value : {}) as Record<string, any>
}

export const useRaffleUri = (raffleId: number) => {
  const { RaffleParty } = useContracts()
  const { value, error } =
    useCall({
      contract: RaffleParty as any,
      method: 'raffleURI', // Method to be called
      args: [raffleId], // Method arguments
    }) ?? {}
  if (error) {
    console.error(error.message)
    return undefined
  }
  return value
}

export const useRaffleWinners = (raffleId: number) => {
  const { RaffleParty } = useContracts()
  const { value, error } =
    useCall({
      contract: RaffleParty as any,
      method: 'raffleWinners', // Method to be called
      args: [raffleId], // Method arguments
    }) ?? {}
  if (error) {
    console.error(error.message)
    return 0
  }
  return value ? value : []
}

export const useRaffleParticipants = (raffleId: number) => {
  const { RaffleParty } = useContracts()
  const { value, error } =
    useCall({
      contract: RaffleParty as any,
      method: 'getRaffleParticipants', // Method to be called
      args: [raffleId], // Method arguments
    }) ?? {}
  if (error) {
    console.error(error.message)
    return 0
  }
  return value ? value : []
}

export const useRaffleCount = () => {
  const { RaffleParty } = useContracts()
  const { value, error } =
    useCall({
      contract: RaffleParty as any,
      method: 'getRaffleCount', // Method to be called
      args: [], // Method arguments
    }) ?? {}
  if (error) {
    console.error(error.message)
    return 0
  }
  return value ? Number(value?.[0]) : 0
}
