import { supabase } from '../../utils/supabaseClient'
import Web3 from 'web3'

const web3 = new Web3()

export default async function hello(req: any, res: any) {
  supabase.auth.setAuth(req.cookies['sb-access-token'])

  const { message, signature } = req.body

  if (!message || !signature) {
    return res
      .status(422)
      .send('Missing fields `user_id`, `payload`, `signature`')
  }

  const { user_id, eth } = message
  if (typeof user_id != 'string' || typeof eth != 'string') {
    return res
      .status(400)
      .send(
        'Either of `user_id`, `eth` strings not found in the signed message'
      )
  }

  const signer = web3.eth.accounts.recover(JSON.stringify(message), signature)
  if (signer.toLowerCase() != eth.toLowerCase()) {
    return res
      .status(400)
      .send('Signer is different than the address in the message')
  }

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user_id, eth })

  if (error) {
    return res.status(400).json({ error })
  }

  return res.status(200).end()
}