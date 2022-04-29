import { Button } from '@chakra-ui/react'
import { useEthers, useTokenAllowance } from '@usedapp/core'
import { ethers } from 'ethers'
import { useMemo } from 'react'
import { useContracts } from '../../constants'

const MAX_UINT256 = ethers.constants.MaxUint256

// 1. If the user has already approved the contract, just
export const ApproveCfti = (props: { owner?: any }) => {
  const { Confetti, RaffleParty } = useContracts()

  const { library, account } = useEthers()
  const owner = props.owner || account
  const spender = RaffleParty.address
  const allowance = useTokenAllowance(Confetti.address, owner, spender)
  // TODO: Set that up in a smarter way
  const requiredAllowance = MAX_UINT256

  const state = useMemo(() => {
    if (allowance?.gte(requiredAllowance) && allowance?.gt(0)) {
      return { msg: 'Approved', disabled: true }
    } else if (
      !account ||
      `${owner}`.toLowerCase() != `${account}`.toLowerCase()
    ) {
      return { msg: 'Not approved', disabled: true }
    } else {
      return {
        msg: 'Approve $CFTI',
        disabled: false,
        onClick: () => {
          const signer = library?.getSigner(account)
          if (signer) {
            Confetti.connect(signer).approve(spender, MAX_UINT256)
          }
        },
      }
    }
  }, [allowance, requiredAllowance, account, owner, library, Confetti, spender])

  return (
    <Button
      size="xs"
      p="0 1px 6px 1px"
      onClick={state.onClick}
      disabled={state.disabled}
    >
      {state.msg}
    </Button>
  )
}
