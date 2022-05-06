import {
  Flex,
  Heading,
  Box,
  Text,
  Grid,
  useDisclosure,
  useToast,
  Button,
} from '@chakra-ui/react'
import { ChainId, useEthers, useGasPrice, useNetwork } from '@usedapp/core'
import assert from 'assert'
import { Fragment, useCallback, useEffect, useState } from 'react'
import { useContracts } from '../../constants'
import { useCurrentSeedRound, useNextSeed } from '../../hooks/useNextSeed'
import {
  useRaffleView,
  useRaffleCount,
  useRaffleUri,
} from '../../hooks/useRaffles'
import { InfoShield } from '../InfoShield'
import { MarketItem } from '../MarketItem'
import { NextSeed } from '../NextSeed'
import PurchaseModal from '../PurchaseModal'

const TabItem: React.FC<{
  value: string
  active?: boolean
  onClick: () => void
}> = (props) => (
  <Box
    px={2}
    h="40px"
    color="#5e578a"
    cursor="pointer"
    userSelect="none"
    onClick={props.onClick}
    background={props.active ? '#2b2254' : '#16112d'}
    boxShadow={
      props.active
        ? '0 -2px 0 0 #372a70,0 2px 0 0 #231b47,-2px 0 0 0 #372a70,2px 0 0 0 #372a70,0 0 0 2px #080611,0 -4px 0 0 #080611,0 4px 0 0 #080611,-4px 0 0 0 #080611,4px 0 0 0 #080611'
        : '0 -2px 0 0 #231b4c,0 2px 0 0 #231b47,-2px 0 0 0 #231b4c,2px 0 0 0 #231b4c,0 0 0 2px #080611,0 -4px 0 0 #080611,0 4px 0 0 #080611,-4px 0 0 0 #080611,4px 0 0 0 #080611'
    }
    transitionDuration=".2s"
  >
    <Text
      as="span"
      fontWeight="bold"
      fontSize="2xl"
      textColor={props.active ? 'white' : undefined}
    >
      {props.value}
    </Text>
  </Box>
)

const roundTo = (value: number, decimals: number) =>
  Math.floor(value * 10 ** decimals) / 10 ** decimals

const formatNumber = (value: any, decimals: number) =>
  isNaN(Number(value)) ? NaN : roundTo(Number(value) / 10 ** 18, decimals)

type Erc721Metadata = {
  name: string
  description: string
  image: string
}

const RaffleItem: React.FC<{
  id: number
  openModalWithData: (data: { raffleId: number; cost: number }) => void
}> = ({ id, openModalWithData }) => {
  const raffle = useRaffleView(id)
  // const metadataUri = useRaffleUri(id % 6)
  const metadataUri = `/api/raffle/${id % 6}`

  const currentRound = useCurrentSeedRound()

  const [data, setData] = useState<Erc721Metadata>()
  useEffect(() => {
    if (!metadataUri) return
    fetch(`${metadataUri}`)
      .then(async (res) => {
        assert(res.ok)
        const { name, description, image } = await res.json()
        if (!name || !description || !image) {
          throw new Error("Responde doesn't contain raffle data")
        }
        setData({ name, description, image })
      })
      .catch((err) => console.error(err))
  }, [metadataUri])

  const { account, library } = useEthers()
  const { RaffleParty } = useContracts()

  const { cost, totalTicketsBought, maxEntries, endingSeedRound } =
    // TODO: Fix the type shape
    raffle as unknown as any
  const roundsLeft = Math.max(
    0,
    Number(endingSeedRound) - Number(currentRound) + 1
  )

  const [winners, setWinners] = useState('')
  useEffect(() => {
    if (roundsLeft > 0) {
      setWinners('')
    } else {
      // TODO: Unify what's on chain and what's not (URI-wise)
      fetch(`/api/raffle/${id}/winners`).then(async (res) => {
        setWinners(
          res.ok ? `Winners: ${await res.text()}` : ''
        )
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundsLeft])

  // TODO: Handle errors
  if (!data || !raffle) return null

  return (
    <MarketItem
      name={`${data.name} (${id})`}
      imgSrc={data.image}
      allocatedSpots={Number(totalTicketsBought)}
      spots={Number(maxEntries)}
      price={formatNumber(cost, 2)}
      onRedeem={() => openModalWithData({ raffleId: id, cost })}
      roundsLeft={roundsLeft}
      buttonTooltip={winners}
    >
      {data.description}
    </MarketItem>
  )
}

export const Marketplace: React.FC = () => {
  const gasPrice = useGasPrice()

  const { account, library } = useEthers()
  const { Confetti, RaffleParty, Party } = useContracts()

  const [activeTab, setActiveTab] = useState<
    'raffles' | 'whitelists' | 'rewards'
  >('raffles')

  const currentRound = useCurrentSeedRound()

  const { isOpen, onOpen, onClose } = useDisclosure()

  const toast = useToast()
  const showErrorToast = useCallback(
    (err: any) => {
      console.error(JSON.stringify(err))
      const error = err.error || err
      toast({
        description: `${error.message}`,
        status: 'error',
        duration: 3000,
      })
    },
    [toast]
  )

  const [cftiCost, setCftiCost] = useState(0)
  const [raffleId, setRaffleId] = useState<number>()

  const openModalWithData = useCallback(
    (data: { raffleId: number; cost: number }) => {
      setRaffleId(data.raffleId)
      setCftiCost(data.cost)
      onOpen()
    },
    [onOpen]
  )

  let raffleCount = useRaffleCount()
  const {
    network: { chainId },
  } = useNetwork()

  return (
    <Box position="relative" h="100%" w="100%" overflow="auto">
      <Flex position="absolute" top={10} right={10} zIndex={10}>
        <NextSeed />
        <InfoShield
          value={`⛽ ${Math.trunc((Number(gasPrice) || 0) / 10 ** 9)}`}
        />
        <InfoShield type="cftiBalance" />
      </Flex>

      <Box
        w="100%"
        minHeight="100%"
        p={10}
        backgroundAttachment="fixed"
        backgroundSize="cover"
        backgroundImage="/tiles.png"
      >
        <Heading textColor="white" lineHeight="36px" mb={0}>
          Market
        </Heading>
        <Text mb={7} fontSize="2xl" textColor="#5E578A" lineHeight="32px">
          Spend your hard-earned CFTI on prizes!
        </Text>
        <Flex gap={4} mb={10}>
          <TabItem
            value="Raffles"
            active={activeTab === 'raffles'}
            onClick={() => setActiveTab('raffles')}
          />
          <TabItem
            value="Whitelists"
            active={activeTab === 'whitelists'}
            onClick={() => setActiveTab('whitelists')}
          />
          <TabItem
            value="Rewards"
            active={activeTab === 'rewards'}
            onClick={() => setActiveTab('rewards')}
          />
        </Flex>
                  <Box
            pb={5}
            mb={5}
            // w="250px"
            boxShadow="0 -2px 0 0 #2b2258,0 2px 0 0 #2b2258,-2px 0 0 0 #2b2258,2px 0 0 0 #2b2258,0 0 0 2px #0a0414,0 -4px 0 0 #0a0414,0 4px 0 0 #0a0414,-4px 0 0 0 #0a0414,4px 0 0 0 #0a0414;"
          >
            <Heading textColor="white" textAlign="center">
              Toy box
            </Heading>
            {chainId != ChainId.Rinkeby && (
              <Heading textColor="red" textAlign="center" mt={-5}>
                Please switch to the Rinkeby testnet
              </Heading>
            )}
            <Flex direction="row" justify="center">
              <Button mx={5} isDisabled={true}>
                Current seed round: {Number(currentRound)}
              </Button>
              <Button
                mx={5}
                onClick={async () => {
                  const signer = library?.getSigner()
                  if (!account || !signer) return
                  const maxEntries = Math.trunc(Math.random() * 10) + 5
                  const winnerCount = Math.trunc(Math.random() * 5) + 1
                  const auxZeroes = Math.trunc(Math.random() * 3)
                  const tail = Array.from({ length: auxZeroes })
                    .map(() => '0')
                    .join('')
                  await RaffleParty.connect(signer)
                    .createRaffle(
                      Number(currentRound) + 3,
                      '100000000000000000' + tail,
                      maxEntries,
                      winnerCount
                    )
                    .catch(showErrorToast)
                }}
              >
                Create raffle
              </Button>
              <Button
                mx={5}
                onClick={async () => {
                  const signer = library?.getSigner()
                  if (!account || !signer) return
                  const heroId = Math.trunc(Math.random() * 4226)
                  await Party.connect(signer)
                    .setUserHero(heroId)
                    .catch(showErrorToast)
                }}
              >
                Stake hero
              </Button>
              <Button
                mx={5}
                onClick={async () => {
                  const signer = library?.getSigner()
                  if (!account || !signer) return
                  await Party.connect(signer)
                    .setUserHero(0)
                    .catch(showErrorToast)
                }}
              >
                Unstake hero
              </Button>
              <Button
                mx={5}
                onClick={async () => {
                  const signer = library?.getSigner()
                  if (!account || !signer || !account) return
                  await Confetti.connect(signer)
                    .mint(account, '1000000000000000000000')
                    .catch(showErrorToast)
                }}
              >
                Mint 1k $TCFTI
              </Button>
            </Flex>
          </Box>
        <Grid
          gap={10}
          gridTemplateColumns="repeat(auto-fill,minmax(250px,1fr))"
        >

          {activeTab === 'raffles'
            ? Array.from({ length: raffleCount }).map((_, idx) => (
                <RaffleItem
                  key={idx}
                  id={idx}
                  openModalWithData={openModalWithData}
                />
              ))
            : []}
        </Grid>
      </Box>
      <PurchaseModal
        raffleId={raffleId}
        cftiCost={cftiCost}
        isOpen={isOpen}
        onClose={onClose}
      />
    </Box>
  )
}
