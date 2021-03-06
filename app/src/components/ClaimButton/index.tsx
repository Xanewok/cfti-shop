import { Button, Tooltip, useToast } from '@chakra-ui/react'
import { useCall, useNetwork } from '@usedapp/core'
import { useCallback } from 'react'
import web3 from 'web3'

import { useContracts } from '../../constants'
import { useSigner } from '../../hooks/useSigner'

export const useIsOperatorForWallets = (operator: any, accounts: any[]) => {
  const { RpYieldCollector } = useContracts()
  const { value, error } =
    useCall(
      operator && {
        contract: RpYieldCollector,
        method: 'isOperatorForWallets',
        args: [operator, accounts.filter((acc) => !!acc)],
      }
    ) ?? {}

  if (error) {
    console.error(error.message)
    return null
  }
  return value?.[0]
}

interface ClaimButtonProps {
  accountList: string[]
  operator: string
  accumulate: { accumulate: boolean; stash: string }
  tax: { collectTax: boolean; taxCollector: string; taxRate: number }
}

export const ClaimButton = (props: ClaimButtonProps) => {
  const {
    accountList,
    operator,
    accumulate: { accumulate, stash },
    tax: { collectTax, taxCollector, taxRate },
  } = props

  const {
    network: { provider, accounts },
  } = useNetwork()
  const { RpYieldCollector } = useContracts()

  const toast = useToast()
  const showErrorToast = useCallback(
    (err: any) => {
      console.error(JSON.stringify(err))
      const error = err.error || err
      toast({
        description: [`${error.message}`, `(${err.code})`].join(' '),
        status: 'error',
        duration: 3000,
      })
    },
    [toast]
  )

  const signer = provider?.getSigner(accounts[0])

  const claimRewards = useCallback(async () => {
    const wallets = accountList.filter(web3.utils.isAddress)
    if (!signer || wallets.length <= 0) {
      return
    }

    try {
      const contract = RpYieldCollector.connect(signer)

      if (!accumulate && !collectTax) {
        const estimate = await contract.estimateGas.claimMultipleRewards(
          wallets
        )
        await contract.claimMultipleRewards(wallets, {
          gasLimit: estimate.add(estimate.div(10)),
        })
      } else if (!collectTax) {
        const estimate = await contract.estimateGas.claimMultipleRewardsTo(
          wallets,
          stash
        )
        await contract.claimMultipleRewardsTo(wallets, stash, {
          gasLimit: estimate.add(estimate.div(10)),
        })
      } else if (!accumulate) {
        const taxBasisPoints = Math.round(taxRate * 100)

        const estimate = await contract.estimateGas.taxedClaimMultipleRewards(
          wallets,
          taxBasisPoints,
          taxCollector
        )
        await contract.taxedClaimMultipleRewards(
          wallets,
          taxBasisPoints,
          taxCollector,
          {
            gasLimit: estimate.add(estimate.div(10)),
          }
        )
      } else {
        const taxBasisPoints = Math.round(taxRate * 100)

        const estimate = await contract.estimateGas.taxedClaimMultipleRewardsTo(
          wallets,
          stash,
          taxBasisPoints,
          taxCollector
        )
        await contract.taxedClaimMultipleRewardsTo(
          wallets,
          stash,
          taxBasisPoints,
          taxCollector,
          {
            gasLimit: estimate.add(estimate.div(10)),
          }
        )
      }
    } catch (e) {
      showErrorToast(e)
    }
  }, [
    accountList,
    signer,
    RpYieldCollector,
    accumulate,
    collectTax,
    stash,
    taxRate,
    taxCollector,
    showErrorToast,
  ])
  // Whether the user needs to execute the action as the operator but the active
  // signer account is different
  const hasToBeOperator = accumulate || collectTax
  const isOperator = operator.toLowerCase() == (accounts[0] || '').toLowerCase()
  // Whether all of the accounts have succesfully authorized the operator account
  const isAuthorized = useIsOperatorForWallets(operator, accountList)

  return (
    <Tooltip
      label={
        hasToBeOperator && !isOperator
          ? 'You need to be the Operator to submit this transaction'
          : hasToBeOperator && !isAuthorized
          ? 'You need to be authorized by every wallet (for each wallet, switch to that wallet and authorize the Operator account using the buttons above)'
          : !accumulate
          ? 'Rewards will be claimed to their respective wallets'
          : 'Rewards will be claimed and sent to the Stash account'
      }
      shouldWrapChildren
    >
      <Button
        fontSize="2xl"
        fontWeight="500"
        disabled={
          !signer ||
          accountList.filter(web3.utils.isAddress).length <= 0 ||
          (hasToBeOperator && !isOperator) ||
          (hasToBeOperator && !isAuthorized)
        }
        mt="1rem"
        ml="auto"
        mr="auto"
        onClick={claimRewards}
      >
        {hasToBeOperator && !isOperator ? 'Switch account' : 'Claim rewards'}
      </Button>
    </Tooltip>
  )
}
